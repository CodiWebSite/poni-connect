// process-payslip-batch
// Split a monthly payslip PDF into per-employee slips (stored unencrypted for admin preview).
// Encryption with CNP-based password happens at distribution time in payslip-batch-action.


import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
// @ts-ignore - pdfjs legacy build
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

// ---------- Name normalization ----------
function normalizeName(s: string): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
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
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = tmp;
    }
  }
  return dp[n];
}

// ---------- PDF text extraction ----------
interface CropBox {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

interface TextCell {
  pageIndex: number;
  positionOnPage: number;
  text: string;
  cropBox: CropBox;
}

interface TextItemLite {
  str: string;
  x: number;
  y: number;
}

function itemsToLines(items: TextItemLite[]): string[] {
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: string[] = [];
  let currentY: number | null = null;
  let currentLine: TextItemLite[] = [];

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) < 3) {
      currentLine.push(item);
      currentY = item.y;
    } else {
      lines.push(currentLine.map((it) => it.str).join(" ").trim());
      currentLine = [item];
      currentY = item.y;
    }
  }

  if (currentLine.length) lines.push(currentLine.map((it) => it.str).join(" ").trim());
  return lines.filter(Boolean);
}

async function extractSlipCells(pdfBytes: Uint8Array): Promise<TextCell[]> {
  const loadingTask = pdfjs.getDocument({
    // pdfjs can transfer/detach the supplied buffer; keep the original bytes usable
    // later by pdf-lib for the actual crop/encrypt step.
    data: pdfBytes.slice(),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  const cells: TextCell[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    const columnWidth = pageWidth / 4;
    const rowHeight = pageHeight / 2;
    const content = await page.getTextContent();

    const buckets: TextItemLite[][] = Array.from({ length: 8 }, () => []);
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const str = item.str?.trim();
      if (!str) continue;

      const x = Number(item.transform?.[4] ?? 0);
      const y = Number(item.transform?.[5] ?? 0);
      const col = Math.max(0, Math.min(3, Math.floor(x / columnWidth)));
      const row = y >= rowHeight ? 0 : 1;
      const index = row * 4 + col;
      buckets[index].push({ str, x, y });
    }

    for (let index = 0; index < buckets.length; index++) {
      const lines = itemsToLines(buckets[index]);
      if (!lines.some((line) => /^LUNA\s*:/i.test(line))) continue;

      const row = Math.floor(index / 4);
      const col = index % 4;
      const left = col * columnWidth;
      const right = col === 3 ? pageWidth : (col + 1) * columnWidth;
      const bottom = row === 0 ? rowHeight : 0;
      const top = row === 0 ? pageHeight : rowHeight;

      cells.push({
        pageIndex: i - 1,
        positionOnPage: index,
        text: lines.join("\n"),
        cropBox: { left, bottom, right, top },
      });
    }
  }

  return cells;
}

// ---------- Slip detection per page ----------
// Each page can contain multiple slips. We split by the boundary
// "ICMPP-<Luna Anul>" header or "LUNA :" line, and pull the name line.
interface DetectedSlip {
  pageIndex: number;      // 0-based
  positionOnPage: number; // 0..N-1 index within page
  cropBox: CropBox;
  marca: string | null;
  rawName: string;
  normalizedName: string;
  monthDetected: number | null;
  yearDetected: number | null;
  netAmount: number | null;
}

const MONTH_MAP: Record<string, number> = {
  "IANUARIE": 1, "FEBRUARIE": 2, "MARTIE": 3, "APRILIE": 4,
  "MAI": 5, "IUNIE": 6, "IULIE": 7, "AUGUST": 8,
  "SEPTEMBRIE": 9, "OCTOMBRIE": 10, "NOIEMBRIE": 11, "DECEMBRIE": 12,
};

function parseSlipCell(cell: TextCell): DetectedSlip | null {
  const lines = cell.text.split("\n").map(l => l.trim()).filter(Boolean);
  const lunaIdx = lines.findIndex((l) => /^LUNA\s*:/i.test(l));
  if (lunaIdx === -1) return null;

  const endIdx = (() => {
    for (let i = lunaIdx + 1; i < lines.length; i++) {
      if (/PRIMIT\s+FLUTURA/i.test(lines[i])) return i;
    }
    return lines.length - 1;
  })();
  const block = lines.slice(lunaIdx, endIdx + 1);

  // Extract month/year: "LUNA : 06.2026" or nearby header "ICMPP-Iunie 2026"
  let month: number | null = null;
  let year: number | null = null;
  const lunaMatch = block[0].match(/LUNA\s*:\s*(\d{1,2})[.\/](\d{4})/i);
  if (lunaMatch) {
    month = parseInt(lunaMatch[1], 10);
    year = parseInt(lunaMatch[2], 10);
  }

  if (!month && lunaIdx > 0) {
    const hdr = lines[lunaIdx - 1];
    const hm = hdr.match(/ICMPP[- ]([A-ZĂÂÎȘȚa-zăâîșț]+)\s+(\d{4})/);
    if (hm) {
      const mName = normalizeName(hm[1]);
      month = MONTH_MAP[mName] ?? null;
      year = parseInt(hm[2], 10);
    }
  }

  // Find name line: pattern "<marca> - <NAME>" where marca is optional digits
  let marca: string | null = null;
  let rawName = "";
  for (let i = 1; i < block.length; i++) {
    const m = block[i].match(/^(\d{3,7})?\s*-\s*(.+)$/);
    if (m && m[2] && /[A-Za-zĂÂÎȘȚăâîșț]/.test(m[2])) {
      const candidate = m[2].trim();
      if (/^[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\s\-]+$/.test(candidate)) {
        marca = m[1] || null;
        rawName = candidate;
        // Some names span 2 lines (e.g. "BUZDUGAN CATALIN\nVALENTIN")
        if (i + 1 < block.length) {
          const next = block[i + 1].trim();
          if (/^[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\s\-]+$/.test(next) && next.length < 40 && !/LUNA|ICMPP|SERVICIUL|specialist|consilier|medic|tehnician|sef|șef|documentarist|bibliotecar|refer|inspector/i.test(next)) {
            if (!next.includes(" ") || next.split(" ").length <= 2) {
              rawName = `${rawName} ${next}`;
            }
          }
        }
        break;
      }
    }
  }

  // Extract net (Salariu net) if present
  let net: number | null = null;
  for (const line of block) {
    const m = line.match(/Salariu\s*net\s*(\d+)/i);
    if (m) { net = parseInt(m[1], 10); break; }
  }

  if (!rawName) return null;

  return {
    pageIndex: cell.pageIndex,
    positionOnPage: cell.positionOnPage,
    cropBox: cell.cropBox,
    marca,
    rawName,
    normalizedName: normalizeName(rawName),
    monthDetected: month,
    yearDetected: year,
    netAmount: net,
  };
}

function parseSlipCells(cells: TextCell[]): DetectedSlip[] {
  const slips: DetectedSlip[] = [];
  for (const cell of cells) {
    const slip = parseSlipCell(cell);
    if (slip) slips.push(slip);
  }
  return slips;
}

// ---------- PDF crop (plain, unencrypted) ----------
// Preview stage: keep the per-employee slip unencrypted so admins can review it.
// Encryption happens only at distribution time (payslip-batch-action -> distribute_batch).
async function cropSubsetToPdf(
  srcDoc: PDFDocument,
  pageIndex: number,
  cropBox: CropBox,
): Promise<Uint8Array> {
  const newDoc = await PDFDocument.create();
  const width = cropBox.right - cropBox.left;
  const height = cropBox.top - cropBox.bottom;
  const embedded = await newDoc.embedPage(srcDoc.getPage(pageIndex), cropBox);
  const page = newDoc.addPage([width, height]);
  page.drawPage(embedded, { x: 0, y: 0, width, height });
  return await newDoc.save();
}


// ---------- Background, resumable processing ----------
// The PDF is uploaded by the browser into storage first; this function only
// receives its path, answers immediately and processes in the background in
// chunks. Progress is saved after each slip, so an interrupted run resumes
// exactly where it stopped (self re-invocation after a time budget).
const CHUNK = 20;
const TIME_BUDGET_MS = 100_000;
const STALE_MS = 90_000;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function background(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
}

async function runBatch(admin: any, batchId: string, supabaseUrl: string, serviceKey: string) {
  const started = Date.now();
  const beat = (fields: Record<string, unknown>) =>
    admin.from("payslip_batches").update({ ...fields, last_heartbeat: new Date().toISOString() }).eq("id", batchId);
  try {
    const { data: batch } = await admin.from("payslip_batches").select("*").eq("id", batchId).single();
    if (!batch || batch.status !== "processing") return;
    const { month, year } = batch;

    await beat({ phase: "detecting", error: null });
    const { data: blob, error: dlErr } = await admin.storage.from("payslips").download(batch.original_file_path);
    if (dlErr || !blob) throw new Error("Nu am putut citi PDF-ul încărcat");
    const buf = new Uint8Array(await blob.arrayBuffer());
    const detected = parseSlipCells(await extractSlipCells(buf));
    if (detected.length === 0) {
      await beat({ status: "failed", phase: "failed", error: "Nu s-au detectat fluturași în PDF. Verificați că este PDF-ul centralizator de la salarizare." });
      return;
    }

    const { count: already } = await admin.from("payslips").select("id", { count: "exact", head: true }).eq("batch_id", batchId);
    let index = already ?? 0;
    await beat({ total_slips: detected.length, processed_count: index, phase: "matching" });

    const { data: employees } = await admin.from("employee_personal_data")
      .select("id, first_name, last_name, cnp").eq("is_archived", false);
    const emps = (employees ?? []) as Array<{ id: string; first_name: string; last_name: string; cnp: string | null }>;
    const byName = new Map<string, string[]>();
    for (const e of emps) {
      for (const key of [normalizeName(`${e.last_name} ${e.first_name}`), normalizeName(`${e.first_name} ${e.last_name}`)]) {
        if (!byName.has(key)) byName.set(key, []);
        if (!byName.get(key)!.includes(e.id)) byName.get(key)!.push(e.id);
      }
    }
    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    await beat({ phase: "splitting" });

    while (index < detected.length) {
      const slip = detected[index];
      let matched: string | null = null;
      let status: "matched" | "needs_confirm" | "unmatched" | "duplicate_name" = "unmatched";
      let notes: string | null = null;
      const exact = byName.get(slip.normalizedName);
      if (exact && exact.length === 1) { matched = exact[0]; status = "matched"; }
      else if (exact && exact.length > 1) { status = "duplicate_name"; notes = `Omonim în bază: ${exact.length} angajați cu același nume`; }
      else {
        let best: { id: string; dist: number; name: string } | null = null;
        for (const [key, ids] of byName) {
          const d = levenshtein(slip.normalizedName, key);
          const maxLen = Math.max(slip.normalizedName.length, key.length);
          if (!maxLen) continue;
          if (d <= 2 && 1 - d / maxLen >= 0.9 && (!best || d < best.dist)) best = { id: ids[0], dist: d, name: key };
        }
        if (best) { matched = best.id; status = "needs_confirm"; notes = `Fuzzy: „${best.name}" (dist=${best.dist})`; }
      }

      let filePath: string | null = null;
      if (matched) {
        const emp = emps.find(e => e.id === matched);
        const cnp = (emp?.cnp ?? "").replace(/\D/g, "");
        if (!emp) { notes = "Angajatul asociat nu mai există în registru"; status = "unmatched"; matched = null; }
        else if (cnp.length < 6) { notes = (notes ? notes + " | " : "") + "CNP lipsă/prea scurt — necesar pentru criptare la distribuție"; status = "unmatched"; matched = null; }
        else {
          try {
            const plain = await cropSubsetToPdf(srcDoc, slip.pageIndex, slip.cropBox);
            const path = `${year}/${String(month).padStart(2, "0")}/${matched}_${batchId}_${slip.positionOnPage}.pdf`;
            const { error: upErr } = await admin.storage.from("payslips").upload(path, plain, { contentType: "application/pdf", upsert: true });
            if (upErr) notes = (notes ? notes + " | " : "") + `Storage error: ${upErr.message}`;
            else filePath = path;
          } catch (e) { notes = (notes ? notes + " | " : "") + `Crop error: ${(e as Error).message}`; }
        }
      }

      const { error: insErr } = await admin.from("payslips").insert({
        batch_id: batchId, employee_epd_id: matched, name_detected: slip.rawName,
        name_normalized: slip.normalizedName, marca_detected: slip.marca, month, year,
        file_path: filePath, net_amount: slip.netAmount, match_status: status, match_notes: notes,
      });
      if (insErr) throw new Error(`Salvare fluturaș eșuată: ${insErr.message}`);
      index++;

      if (index % CHUNK === 0 || index === detected.length) await beat({ processed_count: index });
      if (index < detected.length && Date.now() - started > TIME_BUDGET_MS) {
        // Hand over to a fresh run before the platform cuts us off.
        await fetch(`${supabaseUrl}/functions/v1/process-payslip-batch`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "continue", batch_id: batchId }),
        }).catch(() => {});
        return;
      }
    }

    const { data: rows } = await admin.from("payslips").select("match_status").eq("batch_id", batchId);
    const matchedCount = (rows ?? []).filter((r: any) => r.match_status === "matched").length;
    await beat({ status: "ready", phase: "done", processed_count: detected.length,
      matched_count: matchedCount, unmatched_count: (rows ?? []).length - matchedCount });
    await admin.from("payslip_audit_log").insert({
      user_id: batch.uploaded_by, batch_id: batchId, action: "upload",
      details: { total: detected.length, matched: matchedCount, unmatched: (rows ?? []).length - matchedCount },
    });
  } catch (e) {
    console.error("runBatch error", e);
    // Keep status "processing" so it can be resumed; record the error.
    await beat({ error: (e as Error).message, phase: "paused" });
  }
}

// ---------- Main handler ----------
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
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => null) as any;
    if (!body || typeof body.action !== "string") return jsonResp({ error: "Cerere invalidă" }, 400);

    // Internal hand-over between background runs.
    if (authHeader === `Bearer ${serviceKey}`) {
      if (body.action !== "continue" || typeof body.batch_id !== "string") return jsonResp({ error: "Cerere invalidă" }, 400);
      background(runBatch(admin, body.batch_id, supabaseUrl, serviceKey));
      return jsonResp({ ok: true });
    }

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResp({ error: "Sesiune invalidă" }, 401);
    const userId = userData.user.id;
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("salarizare") && !roleSet.has("super_admin")) return jsonResp({ error: "Nu ai permisiuni pentru această acțiune" }, 403);

    if (body.action === "start") {
      const month = Number(body.month), year = Number(body.year);
      const path = String(body.source_path ?? "");
      if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) return jsonResp({ error: "Lună/an invalid" }, 400);
      if (!/^sources\/[0-9a-f-]{36}\/[\w.-]+\.pdf$/i.test(path) || !path.startsWith(`sources/${userId}/`)) return jsonResp({ error: "Fișier invalid" }, 400);
      const { data: row, error } = await admin.from("payslip_batches").insert({
        month, year, uploaded_by: userId, original_filename: String(body.filename ?? "fluturasi.pdf").slice(0, 200),
        original_file_path: path, total_slips: 0, status: "processing", phase: "queued",
        processed_count: 0, last_heartbeat: new Date().toISOString(),
      }).select("id").single();
      if (error || !row) return jsonResp({ error: "Nu am putut crea lotul" }, 500);
      background(runBatch(admin, row.id, supabaseUrl, serviceKey));
      return jsonResp({ batch_id: row.id });
    }

    if (body.action === "resume") {
      if (typeof body.batch_id !== "string") return jsonResp({ error: "Lot invalid" }, 400);
      const { data: b } = await admin.from("payslip_batches").select("status, last_heartbeat, phase").eq("id", body.batch_id).maybeSingle();
      if (!b || b.status !== "processing") return jsonResp({ error: "Lotul nu este în procesare" }, 400);
      const age = b.last_heartbeat ? Date.now() - new Date(b.last_heartbeat).getTime() : Infinity;
      if (age < STALE_MS && b.phase !== "paused") return jsonResp({ ok: true, running: true });
      await admin.from("payslip_batches").update({ last_heartbeat: new Date().toISOString(), phase: "resuming", error: null }).eq("id", body.batch_id);
      background(runBatch(admin, body.batch_id, supabaseUrl, serviceKey));
      return jsonResp({ ok: true, resumed: true });
    }

    return jsonResp({ error: "Acțiune necunoscută" }, 400);
  } catch (e) {
    console.error("process-payslip-batch error", e);
    return jsonResp({ error: "Eroare internă la procesare" }, 500);
  }
});
