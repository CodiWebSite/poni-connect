import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CsvRow {
  mail: string;
  tip_mail: string;
  info_mail: string;
  nume_curent: string;
  prenume: string;
  inainte_casatorie: string;
  activ: string;
  sters: string;
}

interface MatchResult {
  csv_email: string;
  csv_last_name: string;
  csv_first_name: string;
  epd_id: string | null;
  epd_email: string | null;
  epd_last_name: string | null;
  epd_first_name: string | null;
  match_type: "email" | "name" | "maiden_name" | "none";
  action: "no_change" | "update_email" | "not_found";
  details: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row as unknown as CsvRow);
  }
  return rows;
}

function normalize(s: string): string {
  return (s || "")
    .toUpperCase()
    .replace(/\s*-\s*/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(csvName: string, epdName: string): boolean {
  const a = normalize(csvName);
  const b = normalize(epdName);
  if (!a || !b) return false;
  if (a === b) return true;

  // Check if all words of one are contained in the other
  const aWords = a.split(" ");
  const bWords = b.split(" ");
  const aInB = aWords.every((w) => bWords.includes(w));
  const bInA = bWords.every((w) => aWords.includes(w));
  return aInB || bInA;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is HR/admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check HR role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const allowedRoles = ["super_admin", "hr", "sef_srus", "admin"];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden - HR role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const csvText: string = body.csv;
    const dryRun: boolean = body.dry_run !== false; // default true

    if (!csvText) {
      return new Response(JSON.stringify({ error: "CSV data required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse CSV
    const csvRows = parseCsv(csvText);
    
    // Filter only person employees
    const personRows = csvRows.filter(
      (r) => r.tip_mail === "angajat" && r.info_mail !== "grup administrare IT" && r.mail
    );

    // Fetch all EPD (non-archived)
    const { data: allEpd, error: epdError } = await adminClient
      .from("employee_personal_data")
      .select("id, email, first_name, last_name, is_archived")
      .eq("is_archived", false);

    if (epdError) throw epdError;

    // Build lookup maps
    const epdByEmail = new Map<string, typeof allEpd[0]>();
    const epdByName = new Map<string, typeof allEpd[0][]>();

    for (const epd of allEpd!) {
      epdByEmail.set(epd.email.toLowerCase(), epd);
      const key = normalize(epd.last_name) + "|" + normalize(epd.first_name);
      if (!epdByName.has(key)) epdByName.set(key, []);
      epdByName.get(key)!.push(epd);
    }

    const results: MatchResult[] = [];
    const updates: { id: string; newEmail: string }[] = [];

    for (const row of personRows) {
      const csvEmail = row.mail.toLowerCase().trim();
      const csvLastName = row.nume_curent;
      const csvFirstName = row.prenume;
      const csvMaidenName = row.inainte_casatorie;

      // 1. Try match by email
      const emailMatch = epdByEmail.get(csvEmail);
      if (emailMatch) {
        results.push({
          csv_email: csvEmail,
          csv_last_name: csvLastName,
          csv_first_name: csvFirstName,
          epd_id: emailMatch.id,
          epd_email: emailMatch.email,
          epd_last_name: emailMatch.last_name,
          epd_first_name: emailMatch.first_name,
          match_type: "email",
          action: "no_change",
          details: "Email deja corect în baza de date",
        });
        continue;
      }

      // 2. Try match by name
      const nameKey = normalize(csvLastName) + "|" + normalize(csvFirstName);
      let nameMatches = epdByName.get(nameKey);

      // 3. If no match, try maiden name as last name
      if (!nameMatches && csvMaidenName) {
        const maidenKey = normalize(csvMaidenName) + "|" + normalize(csvFirstName);
        nameMatches = epdByName.get(maidenKey);
      }

      // 4. Fuzzy: try matching last_name only if unique
      if (!nameMatches) {
        const lastNameNorm = normalize(csvLastName);
        const candidates = allEpd!.filter(
          (e) => normalize(e.last_name) === lastNameNorm && namesMatch(csvFirstName, e.first_name)
        );
        if (candidates.length === 1) {
          nameMatches = candidates;
        }
      }

      if (nameMatches && nameMatches.length === 1) {
        const match = nameMatches[0];
        if (match.email.toLowerCase() === csvEmail) {
          results.push({
            csv_email: csvEmail,
            csv_last_name: csvLastName,
            csv_first_name: csvFirstName,
            epd_id: match.id,
            epd_email: match.email,
            epd_last_name: match.last_name,
            epd_first_name: match.first_name,
            match_type: "name",
            action: "no_change",
            details: "Potrivit după nume, email identic",
          });
        } else {
          updates.push({ id: match.id, newEmail: csvEmail });
          results.push({
            csv_email: csvEmail,
            csv_last_name: csvLastName,
            csv_first_name: csvFirstName,
            epd_id: match.id,
            epd_email: match.email,
            epd_last_name: match.last_name,
            epd_first_name: match.first_name,
            match_type: "name",
            action: "update_email",
            details: `Email actualizat: ${match.email} → ${csvEmail}`,
          });
        }
      } else if (nameMatches && nameMatches.length > 1) {
        results.push({
          csv_email: csvEmail,
          csv_last_name: csvLastName,
          csv_first_name: csvFirstName,
          epd_id: null,
          epd_email: null,
          epd_last_name: null,
          epd_first_name: null,
          match_type: "none",
          action: "not_found",
          details: `Multiple potriviri (${nameMatches.length}) - necesită verificare manuală`,
        });
      } else {
        results.push({
          csv_email: csvEmail,
          csv_last_name: csvLastName,
          csv_first_name: csvFirstName,
          epd_id: null,
          epd_email: null,
          epd_last_name: null,
          epd_first_name: null,
          match_type: "none",
          action: "not_found",
          details: "Nicio potrivire în baza de date",
        });
      }
    }

    // Apply updates if not dry run
    let appliedCount = 0;
    if (!dryRun && updates.length > 0) {
      for (const upd of updates) {
        const { error } = await adminClient
          .from("employee_personal_data")
          .update({ email: upd.newEmail, updated_at: new Date().toISOString(), last_updated_by: user.id })
          .eq("id", upd.id);
        if (!error) appliedCount++;
        else console.error("Update error:", upd.id, error.message);
      }
    }

    const summary = {
      total_csv_rows: personRows.length,
      total_epd_active: allEpd!.length,
      matched_by_email: results.filter((r) => r.match_type === "email").length,
      matched_by_name: results.filter((r) => r.match_type === "name").length,
      emails_to_update: updates.length,
      not_found: results.filter((r) => r.action === "not_found").length,
      no_change: results.filter((r) => r.action === "no_change").length,
      dry_run: dryRun,
      applied_updates: appliedCount,
    };

    return new Response(
      JSON.stringify({ summary, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
