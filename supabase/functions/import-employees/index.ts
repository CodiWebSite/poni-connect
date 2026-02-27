import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeePayload {
  email: string;
  first_name: string;
  last_name: string;
  cnp: string;
  department?: string;
  position?: string;
  grade?: string | null;
  contract_type?: string;
  total_leave_days?: number;
  used_leave_days?: number;
  employment_date?: string;
  ci_series?: string | null;
  ci_number?: string | null;
  ci_issued_by?: string | null;
  ci_issued_date?: string | null;
  ci_expiry_date?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_block?: string | null;
  address_floor?: string | null;
  address_apartment?: string | null;
  address_city?: string | null;
  address_county?: string | null;
}

/** Fields safe to update on re-import (never includes leave balances) */
function buildUpdatePayload(record: ReturnType<typeof normalizeRecord>) {
  return {
    first_name: record.first_name,
    last_name: record.last_name,
    department: record.department,
    position: record.position,
    grade: record.grade,
    contract_type: record.contract_type,
    employment_date: record.employment_date,
    ci_series: record.ci_series,
    ci_number: record.ci_number,
    ci_issued_by: record.ci_issued_by,
    ci_issued_date: record.ci_issued_date,
    ci_expiry_date: record.ci_expiry_date,
    address_street: record.address_street,
    address_number: record.address_number,
    address_block: record.address_block,
    address_floor: record.address_floor,
    address_apartment: record.address_apartment,
    address_city: record.address_city,
    address_county: record.address_county,
  };
}

function normalizeRecord(record: EmployeePayload) {
  return {
    email: record.email.toLowerCase(),
    first_name: record.first_name,
    last_name: record.last_name,
    cnp: record.cnp,
    department: record.department || null,
    position: record.position || null,
    grade: record.grade || null,
    contract_type: record.contract_type || 'nedeterminat',
    total_leave_days: record.total_leave_days ?? 21,
    used_leave_days: record.used_leave_days ?? 0,
    employment_date: record.employment_date || new Date().toISOString().split('T')[0],
    ci_series: record.ci_series || null,
    ci_number: record.ci_number || null,
    ci_issued_by: record.ci_issued_by || null,
    ci_issued_date: record.ci_issued_date || null,
    ci_expiry_date: record.ci_expiry_date || null,
    address_street: record.address_street || null,
    address_number: record.address_number || null,
    address_block: record.address_block || null,
    address_floor: record.address_floor || null,
    address_apartment: record.address_apartment || null,
    address_city: record.address_city || null,
    address_county: record.address_county || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");
    
    const { data: canManage, error: roleError } = await supabaseAdmin.rpc('can_manage_hr', { 
      _user_id: user.id 
    });
    if (roleError || !canManage) throw new Error("Insufficient permissions.");
    
    const body = await req.json();
    
    // Parse records from payload
    let records: EmployeePayload[] = [];
    
    if (body.employees && Array.isArray(body.employees)) {
      records = body.employees.filter((emp: EmployeePayload) => 
        emp.email && emp.cnp && emp.first_name && emp.last_name
      );
    } else if (body.csvContent) {
      const lines = body.csvContent.trim().split('\n');
      const headers = lines[0].split(';');
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        if (values.length < headers.length) continue;
        const record: Record<string, string> = {};
        headers.forEach((header: string, index: number) => {
          record[header.trim()] = values[index]?.trim() || '';
        });
        if (!record.email || !record.cnp || !record.first_name || !record.last_name) continue;
        records.push({
          email: record.email,
          first_name: record.first_name,
          last_name: record.last_name,
          cnp: record.cnp,
          department: record.department || null,
          position: record.position || null,
          contract_type: record.contract_type || 'nedeterminat',
          total_leave_days: record.total_leave_days ? parseInt(record.total_leave_days) : 21,
          used_leave_days: record.used_leave_days ? parseInt(record.used_leave_days) : 0,
          employment_date: record.employment_date,
        } as EmployeePayload);
      }
    } else {
      throw new Error("No employee data provided.");
    }
    
    if (records.length === 0) throw new Error("No valid employee records found.");
    
    // Deduplicate by CNP
    const employeeMap = new Map<string, EmployeePayload>();
    for (const record of records) {
      employeeMap.set(record.cnp, record);
    }
    const employeeData = Array.from(employeeMap.values()).map(normalizeRecord);
    
    console.log(`Deduplicated: ${records.length} -> ${employeeData.length} unique CNPs`);
    
    // ── Identify existing vs new employees ──
    const cnpList = employeeData.map(e => e.cnp);
    
    // Fetch all existing records by CNP (including archived status)
    const { data: existingRecords } = await supabaseAdmin
      .from('employee_personal_data')
      .select('cnp, is_archived')
      .in('cnp', cnpList);
    
    const existingCnpMap = new Map<string, boolean>();
    for (const r of (existingRecords || [])) {
      existingCnpMap.set(r.cnp, r.is_archived);
    }
    
    const newEmployees = employeeData.filter(e => !existingCnpMap.has(e.cnp));
    const existingActive = employeeData.filter(e => existingCnpMap.has(e.cnp) && !existingCnpMap.get(e.cnp));
    const skippedArchived = employeeData.filter(e => existingCnpMap.get(e.cnp) === true).length;
    
    console.log(`New: ${newEmployees.length}, Existing active: ${existingActive.length}, Archived (skipped): ${skippedArchived}`);
    
    let inserted = 0;
    let updated = 0;
    let skipped = skippedArchived;
    const errors: string[] = [];
    
    // ── INSERT new employees (with leave data) ──
    if (newEmployees.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < newEmployees.length; i += batchSize) {
        const batch = newEmployees.slice(i, i + batchSize);
        const { data, error } = await supabaseAdmin
          .from('employee_personal_data')
          .insert(batch)
          .select('id');
        
        if (error) {
          console.log(`Batch insert failed, trying individually...`);
          for (const record of batch) {
            const { error: err } = await supabaseAdmin
              .from('employee_personal_data')
              .insert(record)
              .select('id');
            if (!err) {
              inserted++;
            } else {
              console.error(`Insert failed for ${record.email}: ${err.message}`);
              errors.push(`${record.first_name} ${record.last_name} (${record.email}): ${err.message}`);
              skipped++;
            }
          }
        } else {
          inserted += data?.length || 0;
        }
      }
    }
    
    // ── UPDATE existing active employees (WITHOUT leave data) ──
    for (const record of existingActive) {
      const updateData = buildUpdatePayload(record);
      
      // Try update by CNP
      const { error: updateErr } = await supabaseAdmin
        .from('employee_personal_data')
        .update(updateData)
        .eq('cnp', record.cnp)
        .eq('is_archived', false);
      
      if (!updateErr) {
        updated++;
      } else {
        // Fallback: try updating email too if CNP conflict
        const { error: updateErr2 } = await supabaseAdmin
          .from('employee_personal_data')
          .update({ ...updateData, email: record.email })
          .eq('cnp', record.cnp)
          .eq('is_archived', false);
        
        if (!updateErr2) {
          updated++;
        } else {
          console.error(`Update failed for ${record.email}: ${updateErr2.message}`);
          errors.push(`${record.first_name} ${record.last_name}: actualizare eșuată`);
          skipped++;
        }
      }
    }
    
    // ── SYNC employee_records for NEW employees only ──
    console.log("Syncing employee_records for new employees...");
    let syncedRecords = 0;
    
    for (const record of newEmployees) {
      const { data: epd } = await supabaseAdmin
        .from('employee_personal_data')
        .select('employee_record_id')
        .eq('cnp', record.cnp)
        .maybeSingle();
      
      if (epd?.employee_record_id) {
        const { error: syncErr } = await supabaseAdmin
          .from('employee_records')
          .update({
            total_leave_days: record.total_leave_days,
            used_leave_days: record.used_leave_days,
            hire_date: record.employment_date,
            contract_type: record.contract_type,
          })
          .eq('id', epd.employee_record_id);
        
        if (!syncErr) syncedRecords++;
      }
    }
    
    console.log(`Synced ${syncedRecords} employee_records entries`);
    
    // ── Sync profiles with department/position for all active employees ──
    for (const record of [...newEmployees, ...existingActive]) {
      const { data: epd } = await supabaseAdmin
        .from('employee_personal_data')
        .select('employee_record_id')
        .eq('email', record.email)
        .maybeSingle();
      
      if (epd?.employee_record_id) {
        const { data: er } = await supabaseAdmin
          .from('employee_records')
          .select('user_id')
          .eq('id', epd.employee_record_id)
          .maybeSingle();
        
        if (er?.user_id && (record.department || record.position)) {
          const updateData: Record<string, string | null> = {};
          if (record.department) updateData.department = record.department;
          if (record.position) updateData.position = record.position;
          
          await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('user_id', er.user_id);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        imported: inserted,
        updated: updated,
        synced_records: syncedRecords,
        skipped: skipped,
        total: records.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `${inserted} angajați noi importați, ${updated} actualizați (fără modificarea concediilor). ${skippedArchived} arhivați ignorați.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("Import error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
