// process-payslip-batch
// Split a monthly payslip PDF into per-employee, password-encrypted PDFs.
// Match employees by NAME (last_name + first_name), not by marca.

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

// ---------- Encryption ----------
// pdf-lib fork @cantoo/pdf-lib supports save with encryption
async function encryptSubsetToPdf(
  srcDoc: PDFDocument,
  pageIndex: number,
  cropBox: CropBox,
  userPassword: string,
): Promise<Uint8Array> {
  const newDoc = await PDFDocument.create();
  const width = cropBox.right - cropBox.left;
  const height = cropBox.top - cropBox.bottom;
  const embedded = await newDoc.embedPage(srcDoc.getPage(pageIndex), cropBox);
  const page = newDoc.addPage([width, height]);
  page.drawPage(embedded, { x: 0, y: 0, width, height });

  // @ts-ignore - encryption options provided by @cantoo/pdf-lib fork
  const bytes = await newDoc.save({
    // @ts-ignore
    userPassword,
    // @ts-ignore
    ownerPassword: crypto.randomUUID().replace(/-/g, ""),
    // @ts-ignore
    permissions: { printing: "highResolution", copying: false, modifying: false },
  });
  return bytes;
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
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: "Configurare backend incompletă" }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResp({ error: "Sesiune invalidă" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Role check: salarizare or super_admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("salarizare") && !roleSet.has("super_admin")) {
      return jsonResp({ error: "Nu ai permisiuni pentru această acțiune" }, 403);
    }

    // Parse multipart form
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const month = parseInt(String(form.get("month") ?? ""), 10);
    const year = parseInt(String(form.get("year") ?? ""), 10);
    if (!file) return jsonResp({ error: "Fișierul PDF lipsește" }, 400);
    if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100))
      return jsonResp({ error: "Lună/an invalid" }, 400);

    const buf = new Uint8Array(await file.arrayBuffer());
    const slipCells = await extractSlipCells(buf);
    const detected = parseSlipCells(slipCells);

    if (detected.length === 0) {
      return jsonResp({
        error: "Nu s-au detectat fluturași în PDF. Verificați că fișierul este PDF-ul centralizator generat de salarizare, cu blocuri LUNA și nume angajat.",
      }, 422);
    }

    // Load all active employees
    const { data: employees } = await admin
      .from("employee_personal_data")
      .select("id, first_name, last_name, cnp")
      .eq("is_archived", false);
    const emps = (employees ?? []) as Array<{ id: string; first_name: string; last_name: string; cnp: string | null }>;

    // Build lookup by normalized name (both orderings)
    const byName = new Map<string, string[]>(); // name -> [epd_id...]
    for (const e of emps) {
      const a = normalizeName(`${e.last_name} ${e.first_name}`);
      const b = normalizeName(`${e.first_name} ${e.last_name}`);
      for (const key of [a, b]) {
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key)!.push(e.id);
      }
    }

    // Create batch row
    const { data: batchRow, error: batchErr } = await admin
      .from("payslip_batches")
      .insert({
        month, year,
        uploaded_by: userId,
        original_filename: file.name,
        total_slips: detected.length,
        status: "processing",
      })
      .select()
      .single();
    if (batchErr || !batchRow) return jsonResp({ error: "Nu am putut crea lotul", detail: batchErr?.message }, 500);
    const batchId = batchRow.id as string;

    // Group detected slips by their identity: consecutive slips on pages that reference same slip get merged.
    // For now, each detected block is one slip on one page (rare exceptions).
    // Load source pdf via pdf-lib for splitting/encrypting
    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });

    const results: Array<{
      name: string;
      marca: string | null;
      status: string;
      employeeId: string | null;
      notes: string | null;
    }> = [];

    // Track duplicate normalized names within THIS batch — if 2+ detected slips
    // map to the same normalized name AND to different employee_ids, we mark all as duplicate_name.
    // Also: if a normalized name matches multiple employees, mark duplicate_name.

    for (const slip of detected) {
      let matched: string | null = null;
      let status: "matched" | "needs_confirm" | "unmatched" | "duplicate_name" = "unmatched";
      let notes: string | null = null;

      // 1. Exact match
      const exact = byName.get(slip.normalizedName);
      if (exact && exact.length === 1) {
        matched = exact[0];
        status = "matched";
      } else if (exact && exact.length > 1) {
        status = "duplicate_name";
        notes = `Omonim în bază: ${exact.length} angajați cu același nume normalizat`;
      } else {
        // 2. Fuzzy match: distance <= 2 and length ratio ok
        let best: { id: string; dist: number; name: string } | null = null;
        for (const [key, ids] of byName) {
          const d = levenshtein(slip.normalizedName, key);
          const maxLen = Math.max(slip.normalizedName.length, key.length);
          if (maxLen === 0) continue;
          const ratio = 1 - d / maxLen;
          if (d <= 2 && ratio >= 0.9) {
            if (!best || d < best.dist) {
              best = { id: ids[0], dist: d, name: key };
            }
          }
        }
        if (best) {
          matched = best.id;
          status = "needs_confirm";
          notes = `Fuzzy: „${best.name}" (dist=${best.dist})`;
        }
      }

      // Encrypt only when we have a matched employee with a CNP
      let filePath: string | null = null;
      if (matched && (status === "matched" || status === "needs_confirm")) {
        const emp = emps.find(e => e.id === matched);
        if (!emp) {
          notes = (notes ? notes + " | " : "") + "Angajatul asociat nu mai există în registru";
          status = "unmatched";
          matched = null;
        }
        if (!emp) {
          await admin.from("payslips").insert({
            batch_id: batchId,
            employee_epd_id: matched,
            name_detected: slip.rawName,
            name_normalized: slip.normalizedName,
            marca_detected: slip.marca,
            month, year,
            file_path: null,
            net_amount: slip.netAmount,
            match_status: status,
            match_notes: notes,
          });
          results.push({ name: slip.rawName, marca: slip.marca, status, employeeId: matched, notes });
          continue;
        }
        const cnp = (emp.cnp ?? "").replace(/\D/g, "");
        if (cnp.length >= 6) {
          const password = cnp.slice(-6);
          try {
            const encrypted = await encryptSubsetToPdf(srcDoc, slip.pageIndex, slip.cropBox, password);
            const path = `${year}/${String(month).padStart(2, "0")}/${matched}_${batchId}_${slip.positionOnPage}.pdf`;
            const { error: upErr } = await admin.storage
              .from("payslips")
              .upload(path, encrypted, { contentType: "application/pdf", upsert: true });
            if (upErr) {
              notes = (notes ? notes + " | " : "") + `Storage error: ${upErr.message}`;
            } else {
              filePath = path;
            }
          } catch (e) {
            notes = (notes ? notes + " | " : "") + `Encrypt error: ${(e as Error).message}`;
          }
        } else {
          notes = (notes ? notes + " | " : "") + "CNP lipsă/prea scurt — nu se poate cripta";
          status = "unmatched";
          matched = null;
        }
      }

      await admin.from("payslips").insert({
        batch_id: batchId,
        employee_epd_id: matched,
        name_detected: slip.rawName,
        name_normalized: slip.normalizedName,
        marca_detected: slip.marca,
        month, year,
        file_path: filePath,
        net_amount: slip.netAmount,
        match_status: status,
        match_notes: notes,
      });

      results.push({ name: slip.rawName, marca: slip.marca, status, employeeId: matched, notes });
    }

    const matchedCount = results.filter(r => r.status === "matched").length;
    const unmatchedCount = results.filter(r => r.status !== "matched").length;

    await admin.from("payslip_batches").update({
      matched_count: matchedCount,
      unmatched_count: unmatchedCount,
      status: "ready",
    }).eq("id", batchId);

    await admin.from("payslip_audit_log").insert({
      user_id: userId,
      batch_id: batchId,
      action: "upload",
      ip: req.headers.get("x-forwarded-for") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
      details: { total: detected.length, matched: matchedCount, unmatched: unmatchedCount },
    });

    return jsonResp({
      batch_id: batchId,
      total: detected.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      results,
    });
  } catch (e) {
    console.error("process-payslip-batch error", e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
