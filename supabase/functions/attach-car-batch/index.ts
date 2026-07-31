// attach-car-batch
// Takes the monthly CAR (Casa de Ajutor Reciproc) centralizer PDF and appends each
// employee's CAR slip UNDER their existing payslip, inside the SAME single-page PDF.
// Layout of the CAR PDF is auto-detected (grid of cells) and cells are matched to
// employees by name, exactly like the payslip flow.
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
// @ts-ignore - pdfjs legacy build
import * as pdfjs from "pdfjs-dist";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function normalizeName(s: string): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ș|Ş/gi, "S")
    .replace(/Ț|Ţ/gi, "T")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface CropBox { left: number; bottom: number; right: number; top: number }
interface Item { str: string; x: number; y: number }

// Candidate grid layouts [cols, rows] tried on each page of the CAR PDF.
const LAYOUTS: Array<[number, number]> = [
  [1, 1], [2, 1], [1, 2], [2, 2], [3, 1], [3, 2], [4, 1], [4, 2], [2, 3], [2, 4], [1, 3], [1, 4],
];

interface PageData {
  pageIndex: number;
  width: number;
  height: number;
  items: Item[];
}

async function readPages(pdfBytes: Uint8Array): Promise<PageData[]> {
  const doc = await pdfjs.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pages: PageData[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items as Array<{ str: string; transform: number[] }>) {
      const str = it.str?.trim();
      if (!str) continue;
      items.push({ str, x: Number(it.transform?.[4] ?? 0), y: Number(it.transform?.[5] ?? 0) });
    }
    pages.push({ pageIndex: i - 1, width: viewport.width, height: viewport.height, items });
  }
  return pages;
}

interface DetectedCar {
  pageIndex: number;
  cropBox: CropBox;
  epdId: string;
  rawText: string;
}

function cellsForLayout(page: PageData, cols: number, rows: number) {
  const cw = page.width / cols;
  const rh = page.height / rows;
  const cells: Array<{ cropBox: CropBox; text: string }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = c * cw;
      const right = c === cols - 1 ? page.width : (c + 1) * cw;
      // rows counted from top of the page (y is measured from the bottom)
      const top = page.height - r * rh;
      const bottom = r === rows - 1 ? 0 : page.height - (r + 1) * rh;
      const inside = page.items.filter(
        (it) => it.x >= left && it.x < right && it.y >= bottom && it.y < top,
      );
      if (!inside.length) { cells.push({ cropBox: { left, bottom, right, top }, text: "" }); continue; }
      inside.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));
      cells.push({
        cropBox: { left, bottom, right, top },
        text: normalizeName(inside.map((it) => it.str).join(" ")),
      });
    }
  }
  return cells;
}

// Returns the employee ids whose full name appears in the given normalized text.
function matchEmployees(text: string, nameIndex: Array<{ id: string; keys: string[] }>): string[] {
  if (!text) return [];
  const hits = new Set<string>();
  for (const emp of nameIndex) {
    if (emp.keys.some((k) => k.length >= 8 && text.includes(k))) hits.add(emp.id);
  }
  return [...hits];
}

function detectCarSlips(
  pages: PageData[],
  nameIndex: Array<{ id: string; keys: string[] }>,
): DetectedCar[] {
  const out: DetectedCar[] = [];
  for (const page of pages) {
    let best: { score: number; cells: Array<{ cropBox: CropBox; text: string; epdId: string }> } | null = null;
    for (const [cols, rows] of LAYOUTS) {
      const cells = cellsForLayout(page, cols, rows);
      const resolved: Array<{ cropBox: CropBox; text: string; epdId: string }> = [];
      let penalty = 0;
      for (const cell of cells) {
        const hits = matchEmployees(cell.text, nameIndex);
        if (hits.length === 1) resolved.push({ ...cell, epdId: hits[0] });
        else if (hits.length > 1) penalty += 1;
      }
      const score = resolved.length - penalty * 2;
      if (!best || score > best.score) best = { score, cells: resolved };
    }
    if (best && best.score > 0) {
      for (const c of best.cells) {
        out.push({ pageIndex: page.pageIndex, cropBox: c.cropBox, epdId: c.epdId, rawText: c.text.slice(0, 200) });
      }
    }
  }
  return out;
}

// Compose: payslip on top, CAR slip underneath, in ONE single-page PDF.
async function stackPayslipAndCar(
  payslipBytes: Uint8Array,
  carDoc: PDFDocument,
  pageIndex: number,
  cropBox: CropBox,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const payslipDoc = await PDFDocument.load(payslipBytes, { ignoreEncryption: true });

  const topPage = payslipDoc.getPage(0);
  const topEmbedded = await out.embedPage(topPage);
  const topW = topPage.getWidth();
  const topH = topPage.getHeight();

  const carW = cropBox.right - cropBox.left;
  const carH = cropBox.top - cropBox.bottom;
  const carEmbedded = await out.embedPage(carDoc.getPage(pageIndex), cropBox);

  const gap = 12;
  const width = Math.max(topW, carW);
  const height = topH + gap + carH;
  const page = out.addPage([width, height]);

  page.drawPage(topEmbedded, { x: (width - topW) / 2, y: gap + carH, width: topW, height: topH });
  page.drawPage(carEmbedded, { x: (width - carW) / 2, y: 0, width: carW, height: carH });

  return await out.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Nu ești autentificat" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return jsonResp({ error: "Configurare backend incompletă" }, 500);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) return jsonResp({ error: "Sesiune invalidă" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("salarizare") && !roleSet.has("super_admin")) {
      return jsonResp({ error: "Nu ai permisiuni pentru această acțiune" }, 403);
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const batchId = String(form.get("batch_id") ?? "");
    if (!file) return jsonResp({ error: "Fișierul PDF CAR lipsește" }, 400);
    if (!batchId) return jsonResp({ error: "batch_id lipsă" }, 400);

    const { data: batch } = await admin
      .from("payslip_batches").select("id, month, year").eq("id", batchId).maybeSingle();
    if (!batch) return jsonResp({ error: "Lotul nu există" }, 404);

    // Employees for name matching
    const { data: employees } = await admin
      .from("employee_personal_data")
      .select("id, first_name, last_name")
      .eq("is_archived", false);
    const nameIndex = (employees ?? []).map((e: any) => ({
      id: e.id as string,
      keys: [
        normalizeName(`${e.last_name} ${e.first_name}`),
        normalizeName(`${e.first_name} ${e.last_name}`),
      ].filter(Boolean),
    }));

    const buf = new Uint8Array(await file.arrayBuffer());
    const pages = await readPages(buf);
    const detected = detectCarSlips(pages, nameIndex);

    if (detected.length === 0) {
      return jsonResp({
        error: "Nu s-au detectat fluturași CAR în PDF. Verificați că fișierul conține numele angajaților (Nume Prenume) în text selectabil.",
      }, 422);
    }

    // Keep only the first detection per employee
    const byEmployee = new Map<string, DetectedCar>();
    for (const d of detected) if (!byEmployee.has(d.epdId)) byEmployee.set(d.epdId, d);

    const carDoc = await PDFDocument.load(buf, { ignoreEncryption: true });

    // Existing payslips of this batch that have a staged plain file
    const { data: slips } = await admin
      .from("payslips")
      .select("id, employee_epd_id, file_path, file_path_encrypted, car_attached")
      .eq("batch_id", batchId);

    let attached = 0;
    const failures: Array<{ id: string; error: string }> = [];
    const notFound: string[] = [];
    const encryptedCleanup: string[] = [];

    for (const s of (slips ?? []) as any[]) {
      if (!s.employee_epd_id || !s.file_path) continue;
      const car = byEmployee.get(s.employee_epd_id);
      if (!car) { notFound.push(s.id); continue; }
      try {
        const { data: blob, error: dlErr } = await admin.storage.from("payslips").download(s.file_path);
        if (dlErr || !blob) throw new Error(dlErr?.message ?? "download failed");
        const plain = new Uint8Array(await blob.arrayBuffer());
        const merged = await stackPayslipAndCar(plain, carDoc, car.pageIndex, car.cropBox);

        const { error: upErr } = await admin.storage
          .from("payslips")
          .upload(s.file_path, merged, { contentType: "application/pdf", upsert: true });
        if (upErr) throw new Error(upErr.message);

        // The distributed (encrypted) copy is now stale — drop it so the next
        // distribution re-encrypts the merged document.
        if (s.file_path_encrypted) {
          encryptedCleanup.push(s.file_path_encrypted);
        }

        await admin.from("payslips").update({
          car_attached: true,
          file_path_encrypted: null,
          match_status: "matched",
        }).eq("id", s.id);
        attached++;
      } catch (e) {
        failures.push({ id: s.id, error: (e as Error).message });
      }
    }

    if (encryptedCleanup.length) {
      try { await admin.storage.from("payslips").remove(encryptedCleanup); } catch (_) { /* non-fatal */ }
    }

    await admin.from("payslip_batches").update({
      car_filename: file.name,
      car_attached_count: attached,
      status: "ready",
      distributed_at: null,
    }).eq("id", batchId);

    await admin.from("payslip_audit_log").insert({
      user_id: userId,
      batch_id: batchId,
      action: "attach_car",
      details: {
        detected: byEmployee.size,
        attached,
        without_car: notFound.length,
        failures,
        re_encrypt_required: encryptedCleanup.length,
      },
    });

    return jsonResp({
      ok: true,
      detected: byEmployee.size,
      attached,
      without_car: notFound.length,
      failures,
    });
  } catch (e) {
    console.error("attach-car-batch error", e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
