// reprocess-payslip-batch
// Re-splits & encrypts ONLY payslips in an existing batch that are missing file_path.
// Existing distributed/encrypted slips are left untouched.
//
// Input (multipart/form-data):
//   file    — the same monthly centralizer PDF
//   batch_id — the id of the existing payslip_batches row
//
// Auth: salarizare or super_admin.

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

// ---------- helpers (copied from process-payslip-batch) ----------
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
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = tmp;
    }
  }
  return dp[n];
}

interface CropBox { left: number; bottom: number; right: number; top: number }
interface TextCell { pageIndex: number; positionOnPage: number; text: string; cropBox: CropBox }
interface TextItemLite { str: string; x: number; y: number }

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
      cells.push({ pageIndex: i - 1, positionOnPage: index, text: lines.join("\n"), cropBox: { left, bottom, right, top } });
    }
  }
  return cells;
}

interface DetectedSlip {
  pageIndex: number;
  positionOnPage: number;
  cropBox: CropBox;
  rawName: string;
  normalizedName: string;
}

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
  let rawName = "";
  for (let i = 1; i < block.length; i++) {
    const m = block[i].match(/^(\d{3,7})?\s*-\s*(.+)$/);
    if (m && m[2] && /[A-Za-zĂÂÎȘȚăâîșț]/.test(m[2])) {
      const candidate = m[2].trim();
      if (/^[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\s\-]+$/.test(candidate)) {
        rawName = candidate;
        if (i + 1 < block.length) {
          const next = block[i + 1].trim();
          if (/^[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\s\-]+$/.test(next) && next.length < 40 &&
              !/LUNA|ICMPP|SERVICIUL|specialist|consilier|medic|tehnician|sef|șef|documentarist|bibliotecar|refer|inspector/i.test(next)) {
            if (!next.includes(" ") || next.split(" ").length <= 2) {
              rawName = `${rawName} ${next}`;
            }
          }
        }
        break;
      }
    }
  }
  if (!rawName) return null;
  return {
    pageIndex: cell.pageIndex,
    positionOnPage: cell.positionOnPage,
    cropBox: cell.cropBox,
    rawName,
    normalizedName: normalizeName(rawName),
  };
}

// Stage-plain: crop only, no encryption (encryption happens at distribute time).
async function cropSubsetToPdf(
  srcDoc: PDFDocument, pageIndex: number, cropBox: CropBox,
): Promise<Uint8Array> {
  const newDoc = await PDFDocument.create();
  const width = cropBox.right - cropBox.left;
  const height = cropBox.top - cropBox.bottom;
  const embedded = await newDoc.embedPage(srcDoc.getPage(pageIndex), cropBox);
  const page = newDoc.addPage([width, height]);
  page.drawPage(embedded, { x: 0, y: 0, width, height });
  return await newDoc.save();
}


// ---------- main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Nu ești autentificat" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) return jsonResp({ error: "Sesiune invalidă" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("salarizare") && !roleSet.has("super_admin")) {
      return jsonResp({ error: "Nu ai permisiuni" }, 403);
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const batchId = String(form.get("batch_id") ?? "");
    if (!file) return jsonResp({ error: "Fișierul PDF lipsește" }, 400);
    if (!batchId) return jsonResp({ error: "batch_id lipsă" }, 400);

    // Load batch + slips that still need a file
    const { data: batch } = await admin
      .from("payslip_batches").select("id, month, year, status").eq("id", batchId).maybeSingle();
    if (!batch) return jsonResp({ error: "Lotul nu există" }, 404);
    const { month, year } = batch as { month: number; year: number };

    const { data: pendingSlips } = await admin
      .from("payslips")
      .select("id, employee_epd_id, name_normalized, name_detected, match_status")
      .eq("batch_id", batchId)
      .is("file_path", null);
    const pending = (pendingSlips ?? []) as Array<{
      id: string; employee_epd_id: string | null; name_normalized: string; name_detected: string; match_status: string;
    }>;

    if (pending.length === 0) {
      return jsonResp({ ok: true, reprocessed: 0, message: "Toți fluturașii din lot au deja fișier — nimic de re-procesat." });
    }

    // Employees for CNP lookup
    const epdIds = Array.from(new Set(pending.map(p => p.employee_epd_id).filter(Boolean))) as string[];
    const empMap = new Map<string, { cnp: string | null; first_name: string; last_name: string }>();
    if (epdIds.length) {
      const { data: emps } = await admin
        .from("employee_personal_data")
        .select("id, first_name, last_name, cnp")
        .in("id", epdIds);
      for (const e of (emps ?? [])) empMap.set(e.id as string, {
        cnp: (e as any).cnp, first_name: (e as any).first_name, last_name: (e as any).last_name,
      });
    }

    // Parse the PDF
    const buf = new Uint8Array(await file.arrayBuffer());
    const cells = await extractSlipCells(buf);
    const detected: DetectedSlip[] = [];
    for (const c of cells) { const d = parseSlipCell(c); if (d) detected.push(d); }
    if (detected.length === 0) {
      return jsonResp({ error: "Nu s-au detectat fluturași în PDF." }, 422);
    }

    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });

    // For each pending slip, find its detected page by name (exact, then fuzzy).
    const usedPositions = new Set<string>();
    const results: Array<{ name: string; status: "ok" | "no_match" | "no_cnp" | "error"; message?: string }> = [];
    let reprocessed = 0;

    for (const slip of pending) {
      const target = slip.name_normalized || normalizeName(slip.name_detected);
      let match: DetectedSlip | null = null;

      // exact normalized name
      for (const d of detected) {
        const key = `${d.pageIndex}:${d.positionOnPage}`;
        if (usedPositions.has(key)) continue;
        if (d.normalizedName === target) { match = d; break; }
      }
      // fuzzy fallback
      if (!match) {
        let best: { d: DetectedSlip; dist: number } | null = null;
        for (const d of detected) {
          const key = `${d.pageIndex}:${d.positionOnPage}`;
          if (usedPositions.has(key)) continue;
          const dist = levenshtein(target, d.normalizedName);
          const maxLen = Math.max(target.length, d.normalizedName.length);
          if (maxLen === 0) continue;
          const ratio = 1 - dist / maxLen;
          if (dist <= 3 && ratio >= 0.85) {
            if (!best || dist < best.dist) best = { d, dist };
          }
        }
        if (best) match = best.d;
      }

      if (!match) {
        results.push({ name: slip.name_detected, status: "no_match", message: "Nu s-a găsit în PDF-ul re-încărcat" });
        continue;
      }
      usedPositions.add(`${match.pageIndex}:${match.positionOnPage}`);

      if (!slip.employee_epd_id) {
        results.push({ name: slip.name_detected, status: "no_match", message: "Fluturașul nu are angajat asociat" });
        continue;
      }
      const emp = empMap.get(slip.employee_epd_id);
      const cnp = (emp?.cnp ?? "").replace(/\D/g, "");
      if (cnp.length < 6) {
        results.push({ name: slip.name_detected, status: "no_cnp", message: "CNP lipsă/prea scurt" });
        continue;
      }

      try {
        const password = cnp.slice(-6);
        const encrypted = await encryptSubsetToPdf(srcDoc, match.pageIndex, match.cropBox, password);
        const path = `${year}/${String(month).padStart(2, "0")}/${slip.employee_epd_id}_${batchId}_${match.positionOnPage}_r.pdf`;
        const { error: upErr } = await admin.storage
          .from("payslips")
          .upload(path, encrypted, { contentType: "application/pdf", upsert: true });
        if (upErr) throw new Error(upErr.message);

        const newStatus = slip.match_status === "unmatched" ? "needs_confirm" : slip.match_status;
        await admin.from("payslips").update({
          file_path: path,
          match_status: newStatus,
          match_notes: "Re-procesat — fișier criptat re-generat",
        }).eq("id", slip.id);

        await admin.from("payslip_audit_log").insert({
          user_id: userId, payslip_id: slip.id, batch_id: batchId, action: "reprocess",
        });

        reprocessed++;
        results.push({ name: slip.name_detected, status: "ok" });
      } catch (e) {
        results.push({ name: slip.name_detected, status: "error", message: (e as Error).message });
      }
    }

    // Refresh matched/unmatched counts on the batch
    const { data: allSlips } = await admin
      .from("payslips").select("match_status").eq("batch_id", batchId);
    const matchedCount = (allSlips ?? []).filter((s: any) => s.match_status === "matched" || s.match_status === "distributed").length;
    const unmatchedCount = (allSlips ?? []).length - matchedCount;
    await admin.from("payslip_batches").update({
      matched_count: matchedCount,
      unmatched_count: unmatchedCount,
    }).eq("id", batchId);

    return jsonResp({ ok: true, reprocessed, total_pending: pending.length, results });
  } catch (e) {
    console.error("reprocess-payslip-batch error", e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
