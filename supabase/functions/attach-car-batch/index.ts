// attach-car-batch
// Takes the monthly CAR (Casa de Ajutor Reciproc) centralizer PDF and appends each
// employee's CAR slip UNDER their existing payslip, inside the SAME single-page PDF.
//
// Detection is anchor-based (not a fixed grid): every CAR card starts with the
// "C.A.R." header, so we cluster those anchors into columns/rows, assign every text
// item to the card whose anchor sits above-left of it, and crop exactly that card.
// Works for any number of cards per page and for rotated pages (/Rotate 90 etc.).
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, degrees } from "pdf-lib";
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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = tmp;
    }
  }
  return dp[n];
}

interface CropBox { left: number; bottom: number; right: number; top: number }
interface Item { str: string; w: number; h: number; u: number; v: number }

// Map PDF user-space coords to "display" coords (u = horizontal, v = vertical, up)
function toDisp(rot: number, x: number, y: number) {
  if (rot === 90) return { u: y, v: -x };
  if (rot === 180) return { u: -x, v: -y };
  if (rot === 270) return { u: -y, v: x };
  return { u: x, v: y };
}
function toUser(rot: number, u0: number, u1: number, v0: number, v1: number): CropBox {
  if (rot === 90) return { left: -v1, right: -v0, bottom: u0, top: u1 };
  if (rot === 180) return { left: -u1, right: -u0, bottom: -v1, top: -v0 };
  if (rot === 270) return { left: v0, right: v1, bottom: -u1, top: -u0 };
  return { left: u0, right: u1, bottom: v0, top: v1 };
}

function cluster(vals: number[], tol: number): number[] {
  const s = [...vals].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of s) if (!out.length || v - out[out.length - 1] > tol) out.push(v);
  return out;
}
function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

interface DetectedCar {
  pageIndex: number;
  rotation: number;
  cropBox: CropBox;
  marca: string | null;
  rawName: string;
  normalizedName: string;
}

const JUNK = /ESA21|CONSALT|^BG\d{3,}/i;

async function detectCarCards(pdfBytes: Uint8Array): Promise<DetectedCar[]> {
  const doc = await pdfjs.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const out: DetectedCar[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const rot = Number(page.rotate ?? 0);
    const [vx0, vy0, vx1, vy1] = page.view as number[];
    const corners = [[vx0, vy0], [vx1, vy0], [vx0, vy1], [vx1, vy1]].map(([x, y]) => toDisp(rot, x, y));
    const pageU: [number, number] = [Math.min(...corners.map(c => c.u)), Math.max(...corners.map(c => c.u))];
    const pageV: [number, number] = [Math.min(...corners.map(c => c.v)), Math.max(...corners.map(c => c.v))];

    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items as Array<{ str: string; width?: number; height?: number; transform: number[] }>) {
      const str = it.str?.trim();
      if (!str || JUNK.test(str)) continue;
      const d = toDisp(rot, Number(it.transform?.[4] ?? 0), Number(it.transform?.[5] ?? 0));
      items.push({ str, w: Number(it.width ?? 0), h: Number(it.height ?? 8), u: d.u, v: d.v });
    }

    const anchors = items.filter(i => /C\.A\.R\./i.test(i.str));
    if (!anchors.length) continue;

    const us = cluster(anchors.map(a => a.u), 20);                 // left → right
    const vs = cluster(anchors.map(a => a.v), 20).reverse();       // top → bottom
    const pitchU = us.length > 1 ? median(us.slice(1).map((u, i) => u - us[i])) : pageU[1] - us[0];
    const pitchV = vs.length > 1 ? median(vs.slice(1).map((v, i) => vs[i] - v)) : vs[0] - pageV[0];

    // Assign each item to the card whose anchor is above-left of it
    const buckets = new Map<string, Item[]>();
    for (const it of items) {
      let ci = -1;
      for (let i = 0; i < us.length; i++) if (it.u >= us[i] - 10) ci = i;
      let ri = -1;
      for (let i = 0; i < vs.length; i++) if (it.v <= vs[i] + 12) ri = i;
      if (ci < 0 || ri < 0) continue;
      const k = `${ci}|${ri}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(it);
    }

    for (const [k, its] of buckets) {
      const [ci, ri] = k.split("|").map(Number);
      const text = its
        .slice()
        .sort((a, b) => (Math.abs(a.v - b.v) > 2 ? b.v - a.v : a.u - b.u))
        .map(i => i.str)
        .join(" ");
      if (!/C\.A\.R\./i.test(text)) continue;

      // "<marca> <NUME PRENUME> ... Imprumut"
      const m = text.match(/(\d{4,7})\s+([A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\-. ]{3,60}?)\s+Imprumut/);
      if (!m) continue;

      const minU = Math.min(us[ci], ...its.map(i => i.u));
      const maxU = Math.max(...its.map(i => i.u + i.w));
      const minV = Math.min(...its.map(i => i.v));
      const maxV = Math.max(...its.map(i => i.v + i.h));
      const nextU = us[ci + 1] !== undefined ? us[ci + 1] + 2 : pageU[1];
      const nextV = vs[ri + 1] !== undefined ? vs[ri + 1] + 14 : pageV[0];

      const cu0 = Math.max(minU - 8, pageU[0]);
      const cu1 = Math.min(maxU + 8, nextU, us[ci] + pitchU, pageU[1]);
      const cv1 = Math.min(maxV + 6, pageV[1]);
      const cv0 = Math.max(minV - 8, nextV, cv1 - pitchV, pageV[0]);
      if (cu1 - cu0 < 40 || cv1 - cv0 < 30) continue;

      const rawName = m[2].trim();
      out.push({
        pageIndex: p - 1,
        rotation: ((rot % 360) + 360) % 360,
        cropBox: toUser(rot, cu0, cu1, cv0, cv1),
        marca: m[1] ?? null,
        rawName,
        normalizedName: normalizeName(rawName),
      });
    }
  }

  return out;
}

// Compose: payslip on top, CAR slip underneath, in ONE single-page PDF.
async function stackPayslipAndCar(
  payslipBytes: Uint8Array,
  carDoc: PDFDocument,
  car: DetectedCar,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const payslipDoc = await PDFDocument.load(payslipBytes, { ignoreEncryption: true });

  const topPage = payslipDoc.getPage(0);
  const topEmbedded = await out.embedPage(topPage);
  const topW = topPage.getWidth();
  const topH = topPage.getHeight();

  const boxW = car.cropBox.right - car.cropBox.left;
  const boxH = car.cropBox.top - car.cropBox.bottom;
  const carEmbedded = await out.embedPage(carDoc.getPage(car.pageIndex), car.cropBox);

  // Upright dimensions after compensating the source page rotation
  const rotated = car.rotation === 90 || car.rotation === 270;
  const carW = rotated ? boxH : boxW;
  const carH = rotated ? boxW : boxH;

  const gap = 12;
  const width = Math.max(topW, carW);
  const height = topH + gap + carH;
  const page = out.addPage([width, height]);

  page.drawPage(topEmbedded, { x: (width - topW) / 2, y: gap + carH, width: topW, height: topH });

  const ox = (width - carW) / 2;
  if (car.rotation === 90) {
    page.drawPage(carEmbedded, { x: ox, y: carH, width: boxW, height: boxH, rotate: degrees(-90) });
  } else if (car.rotation === 270) {
    page.drawPage(carEmbedded, { x: ox + carW, y: 0, width: boxW, height: boxH, rotate: degrees(90) });
  } else if (car.rotation === 180) {
    page.drawPage(carEmbedded, { x: ox + carW, y: carH, width: boxW, height: boxH, rotate: degrees(180) });
  } else {
    page.drawPage(carEmbedded, { x: ox, y: 0, width: boxW, height: boxH });
  }

  return await out.save();
}

// Undo a previous merge (legacy files with no pristine backup): keep only the top payslip area.
async function stripCarStrip(mergedBytes: Uint8Array, car: DetectedCar): Promise<Uint8Array> {
  const src = await PDFDocument.load(mergedBytes, { ignoreEncryption: true });
  const page = src.getPage(0);
  const W = page.getWidth();
  const H = page.getHeight();
  const boxW = car.cropBox.right - car.cropBox.left;
  const boxH = car.cropBox.top - car.cropBox.bottom;
  const rotated = car.rotation === 90 || car.rotation === 270;
  const carH = rotated ? boxW : boxH;
  const gap = 12;
  const bottom = gap + carH;
  const topH = H - bottom;
  if (topH < 60) return mergedBytes; // nothing sensible to strip
  const out = await PDFDocument.create();
  const embedded = await out.embedPage(page, { left: 0, bottom, right: W, top: H });
  const p = out.addPage([W, topH]);
  p.drawPage(embedded, { x: 0, y: 0, width: W, height: topH });
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
    const emps = (employees ?? []) as Array<{ id: string; first_name: string; last_name: string }>;

    const byName = new Map<string, string[]>();
    for (const e of emps) {
      for (const key of [
        normalizeName(`${e.last_name} ${e.first_name}`),
        normalizeName(`${e.first_name} ${e.last_name}`),
      ]) {
        if (!key) continue;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key)!.push(e.id);
      }
    }
    const allKeys = [...byName.keys()];

    const buf = new Uint8Array(await file.arrayBuffer());
    const detected = await detectCarCards(buf);

    if (detected.length === 0) {
      return jsonResp({
        error: "Nu s-au detectat fluturași CAR în PDF. Verificați că fișierul conține numele angajaților în text selectabil.",
      }, 422);
    }

    // ---- Primary index: by "marca" (employee number) — unambiguous, no name fuzziness.
    const carByMarca = new Map<string, DetectedCar>();
    const ambiguousMarca = new Set<string>();
    for (const card of detected) {
      const mk = (card.marca ?? "").replace(/^0+/, "");
      if (!mk) continue;
      if (carByMarca.has(mk)) { ambiguousMarca.add(mk); continue; }
      carByMarca.set(mk, card);
    }
    for (const mk of ambiguousMarca) carByMarca.delete(mk);

    // ---- Secondary index: by employee (strict name match, fuzzy only when unique)
    const byEmployee = new Map<string, DetectedCar>();
    const unresolved: string[] = [];
    for (const card of detected) {
      let ids = byName.get(card.normalizedName);
      if (!ids || ids.length !== 1) {
        // fuzzy fallback, but only when the best candidate is clearly better than the runner-up
        let best: { key: string; d: number } | null = null;
        let second = Infinity;
        for (const key of allKeys) {
          if (Math.abs(key.length - card.normalizedName.length) > 3) continue;
          const d = levenshtein(key, card.normalizedName);
          if (!best || d < best.d) { second = best ? best.d : second; best = { key, d }; }
          else if (d < second) second = d;
        }
        if (best && best.d <= 2 && second - best.d >= 2) ids = byName.get(best.key);
      }
      if (ids && ids.length === 1) {
        if (!byEmployee.has(ids[0])) byEmployee.set(ids[0], card);
      } else {
        unresolved.push(card.rawName);
      }
    }

    const carDoc = await PDFDocument.load(buf, { ignoreEncryption: true });

    const { data: slips } = await admin
      .from("payslips")
      .select("id, employee_epd_id, marca_detected, file_path, file_path_encrypted, car_attached")
      .eq("batch_id", batchId);

    let attached = 0;
    const failures: Array<{ id: string; error: string }> = [];
    const notFound: string[] = [];
    const encryptedCleanup: string[] = [];
    let matchedByMarca = 0;
    let matchedByName = 0;

    const origPathOf = (p: string) => p.replace(/\.pdf$/i, "") + ".orig.pdf";

    for (const s of (slips ?? []) as any[]) {
      if (!s.file_path) continue;
      const mk = String(s.marca_detected ?? "").replace(/^0+/, "");
      let car: DetectedCar | undefined = mk ? carByMarca.get(mk) : undefined;
      if (car) matchedByMarca++;
      else if (s.employee_epd_id) {
        car = byEmployee.get(s.employee_epd_id);
        if (car) matchedByName++;
      }
      if (!car) { notFound.push(s.id); continue; }
      try {
        const origPath = origPathOf(s.file_path);

        // 1) Always work from a pristine payslip so re-uploads never stack a second CAR slip.
        let base: Uint8Array | null = null;
        const { data: origBlob } = await admin.storage.from("payslips").download(origPath);
        if (origBlob) {
          base = new Uint8Array(await origBlob.arrayBuffer());
        } else {
          const { data: blob, error: dlErr } = await admin.storage.from("payslips").download(s.file_path);
          if (dlErr || !blob) throw new Error(dlErr?.message ?? "download failed");
          base = new Uint8Array(await blob.arrayBuffer());

          if (s.car_attached) {
            // Legacy merged file without backup: strip the CAR strip at the bottom.
            base = await stripCarStrip(base, car);
          }
          // Keep the pristine copy for future re-uploads.
          await admin.storage.from("payslips").upload(origPath, base, {
            contentType: "application/pdf", upsert: true,
          });
        }

        const merged = await stackPayslipAndCar(base, carDoc, car);

        const { error: upErr } = await admin.storage
          .from("payslips")
          .upload(s.file_path, merged, { contentType: "application/pdf", upsert: true });
        if (upErr) throw new Error(upErr.message);

        if (s.file_path_encrypted) encryptedCleanup.push(s.file_path_encrypted);

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
        cards_found: detected.length,
        matched_employees: byEmployee.size,
        matched_by_marca: matchedByMarca,
        matched_by_name: matchedByName,
        ambiguous_marca: [...ambiguousMarca].slice(0, 50),
        unresolved_names: unresolved.slice(0, 50),
        attached,
        without_car: notFound.length,
        failures,
        re_encrypt_required: encryptedCleanup.length,
      },
    });

    return jsonResp({
      ok: true,
      cards_found: detected.length,
      detected: carByMarca.size || byEmployee.size,
      matched_by_marca: matchedByMarca,
      matched_by_name: matchedByName,
      attached,
      without_car: notFound.length,
      unresolved_names: unresolved.slice(0, 50),
      failures,
    });

  } catch (e) {
    console.error("attach-car-batch error", e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
