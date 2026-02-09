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
    
    // Insert in batches of 50, with individual fallback for failed batches
    const batchSize = 50;
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < employeeData.length; i += batchSize) {
      const batch = employeeData.slice(i, i + batchSize);
      
      // Try batch upsert by cnp first
      const { data, error } = await supabaseAdmin
        .from('employee_personal_data')
        .upsert(batch, { 
          onConflict: 'cnp',
          ignoreDuplicates: false 
        })
        .select('id');
      
      if (error) {
        console.log(`Batch ${Math.floor(i/batchSize) + 1} failed on cnp upsert, trying individual records...`);
        
        // Process each record individually when batch fails
        for (const record of batch) {
          // First try: upsert by CNP
          const { error: err1 } = await supabaseAdmin
            .from('employee_personal_data')
            .upsert(record, { onConflict: 'cnp', ignoreDuplicates: false })
            .select('id');
          
          if (!err1) {
            inserted++;
            continue;
          }
          
          // CNP upsert failed - likely email conflict. 
          // Find and update the existing record by email, then retry
          console.log(`Individual cnp upsert failed for ${record.email}: ${err1.message}`);
          
          // Try: update existing record matching this email with new data
          const { data: existing } = await supabaseAdmin
            .from('employee_personal_data')
            .select('id, cnp')
            .eq('email', record.email)
            .maybeSingle();
          
          if (existing) {
            // Update the existing email record with new CNP and data
            const { error: updateErr } = await supabaseAdmin
              .from('employee_personal_data')
              .update({
                cnp: record.cnp,
                first_name: record.first_name,
                last_name: record.last_name,
                department: record.department,
                position: record.position,
                contract_type: record.contract_type,
                total_leave_days: record.total_leave_days,
                used_leave_days: record.used_leave_days,
                employment_date: record.employment_date,
              })
              .eq('id', existing.id);
            
            if (!updateErr) {
              inserted++;
              continue;
            }
            console.error(`Update by email failed for ${record.email}:`, updateErr.message);
          }
          
          // Try: find by CNP and update email
          const { data: existingByCnp } = await supabaseAdmin
            .from('employee_personal_data')
            .select('id, email')
            .eq('cnp', record.cnp)
            .maybeSingle();
          
          if (existingByCnp) {
            const { error: updateErr2 } = await supabaseAdmin
              .from('employee_personal_data')
              .update({
                email: record.email,
                first_name: record.first_name,
                last_name: record.last_name,
                department: record.department,
                position: record.position,
                contract_type: record.contract_type,
                total_leave_days: record.total_leave_days,
                used_leave_days: record.used_leave_days,
                employment_date: record.employment_date,
              })
              .eq('id', existingByCnp.id);
            
            if (!updateErr2) {
              inserted++;
              continue;
            }
            console.error(`Update by cnp failed for ${record.cnp}:`, updateErr2.message);
          }
          
          // All strategies failed
          errors.push(`${record.first_name} ${record.last_name} (${record.email}): nu s-a putut importa`);
          skipped++;
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
