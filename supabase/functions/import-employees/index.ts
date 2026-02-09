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
  contract_type?: string;
  total_leave_days?: number;
  used_leave_days?: number;
  employment_date?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verify user has HR permissions
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }
    
    const { data: canManage, error: roleError } = await supabaseAdmin.rpc('can_manage_hr', { 
      _user_id: user.id 
    });
    
    if (roleError || !canManage) {
      throw new Error("Insufficient permissions. Only HR personnel can import employees.");
    }
    
    const body = await req.json();
    
    // Support both new JSON format and legacy CSV format
    let records: EmployeePayload[] = [];
    
    if (body.employees && Array.isArray(body.employees)) {
      // New JSON array format
      records = body.employees.filter((emp: EmployeePayload) => 
        emp.email && emp.cnp && emp.first_name && emp.last_name
      );
    } else if (body.csvContent) {
      // Legacy CSV format - parse it
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
      throw new Error("No employee data provided. Send either 'employees' (JSON array) or 'csvContent'.");
    }
    
    console.log(`Processing ${records.length} employee records`);
    
    if (records.length === 0) {
      throw new Error("No valid employee records found in the provided data.");
    }
    
    // Transform records for insertion and deduplicate by CNP
    const employeeMap = new Map<string, typeof records[0]>();
    for (const record of records) {
      // Keep last occurrence (overwrite duplicates)
      employeeMap.set(record.cnp, record);
    }
    
    const employeeData = Array.from(employeeMap.values()).map(record => ({
      email: record.email.toLowerCase(),
      first_name: record.first_name,
      last_name: record.last_name,
      cnp: record.cnp,
      department: record.department || null,
      position: record.position || null,
      contract_type: record.contract_type || 'nedeterminat',
      total_leave_days: record.total_leave_days ?? 21,
      used_leave_days: record.used_leave_days ?? 0,
      employment_date: record.employment_date || new Date().toISOString().split('T')[0],
    }));
    
    console.log(`Deduplicated: ${records.length} -> ${employeeData.length} unique CNPs`);
    
    // Insert in batches of 50
    const batchSize = 50;
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < employeeData.length; i += batchSize) {
      const batch = employeeData.slice(i, i + batchSize);
      
      // Try upsert by cnp first, then by email
      const { data, error } = await supabaseAdmin
        .from('employee_personal_data')
        .upsert(batch, { 
          onConflict: 'cnp',
          ignoreDuplicates: false 
        })
        .select('id');
      
      if (error) {
        console.error(`Batch error (cnp upsert):`, error);
        // Fallback: try by email
        const { data: data2, error: error2 } = await supabaseAdmin
          .from('employee_personal_data')
          .upsert(batch, { 
            onConflict: 'email',
            ignoreDuplicates: false 
          })
          .select('id');
        
        if (error2) {
          console.error(`Batch error (email upsert):`, error2);
          errors.push(`Lot ${Math.floor(i/batchSize) + 1}: ${error2.message}`);
          skipped += batch.length;
        } else {
          inserted += data2?.length || 0;
        }
      } else {
        inserted += data?.length || 0;
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        imported: inserted,
        skipped: skipped,
        total: records.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Importați ${inserted} din ${records.length} angajați.`
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
