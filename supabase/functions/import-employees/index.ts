import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeeRecord {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  cnp: string;
  ci_series: string;
  ci_number: string;
  ci_issued_by: string;
  ci_issued_date: string;
  address_street: string;
  address_number: string;
  address_block: string;
  address_floor: string;
  address_apartment: string;
  address_city: string;
  address_county: string;
  employment_date: string;
}

function parseCSV(csvContent: string): EmployeeRecord[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(';');
  
  const records: EmployeeRecord[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    if (values.length < headers.length) continue;
    
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header.trim()] = values[index]?.trim() || '';
    });
    
    // Skip records without required fields
    if (!record.email || !record.cnp || !record.first_name || !record.last_name) {
      console.log(`Skipping record with missing data: ${JSON.stringify(record)}`);
      continue;
    }
    
    records.push(record as unknown as EmployeeRecord);
  }
  
  return records;
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
    
    // Use service role for bulk insert (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Also create a client with user's auth to verify permissions
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verify user has HR permissions
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }
    
    // Check if user can manage HR
    const { data: canManage, error: roleError } = await supabaseAdmin.rpc('can_manage_hr', { 
      _user_id: user.id 
    });
    
    if (roleError || !canManage) {
      throw new Error("Insufficient permissions. Only HR personnel can import employees.");
    }
    
    const { csvContent } = await req.json();
    
    if (!csvContent) {
      throw new Error("CSV content is required");
    }
    
    const records = parseCSV(csvContent);
    console.log(`Parsed ${records.length} employee records`);
    
    // Transform records for insertion
    const employeeData = records.map(record => ({
      original_id: record.id || null,
      email: record.email.toLowerCase(),
      first_name: record.first_name,
      last_name: record.last_name,
      cnp: record.cnp,
      ci_series: record.ci_series || null,
      ci_number: record.ci_number || null,
      ci_issued_by: record.ci_issued_by || null,
      ci_issued_date: record.ci_issued_date || null,
      address_street: record.address_street || null,
      address_number: record.address_number || null,
      address_block: record.address_block || null,
      address_floor: record.address_floor || null,
      address_apartment: record.address_apartment || null,
      address_city: record.address_city || null,
      address_county: record.address_county || null,
      employment_date: record.employment_date,
    }));
    
    // Insert in batches of 50 to avoid timeout
    const batchSize = 50;
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < employeeData.length; i += batchSize) {
      const batch = employeeData.slice(i, i + batchSize);
      
      const { data, error } = await supabaseAdmin
        .from('employee_personal_data')
        .upsert(batch, { 
          onConflict: 'email',
          ignoreDuplicates: false 
        })
        .select('id');
      
      if (error) {
        console.error(`Batch error:`, error);
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        skipped += batch.length;
      } else {
        inserted += data?.length || 0;
      }
    }
    
    // Now sync with existing profiles - link employees who already have accounts
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('user_id, full_name');
    
    if (profiles && profiles.length > 0) {
      // For each profile, try to find matching employee_personal_data by name
      for (const profile of profiles) {
        if (!profile.full_name) continue;
        
        // Try to match by name (first_name + last_name)
        const nameParts = profile.full_name.toUpperCase().trim().split(' ');
        
        // Update employee_records if needed
        const { data: existingRecord } = await supabaseAdmin
          .from('employee_records')
          .select('id')
          .eq('user_id', profile.user_id)
          .maybeSingle();
        
        if (existingRecord) {
          // Link employee_personal_data to employee_records
          await supabaseAdmin
            .from('employee_personal_data')
            .update({ employee_record_id: existingRecord.id })
            .or(`first_name.ilike.%${nameParts[0]}%,last_name.ilike.%${nameParts[nameParts.length - 1]}%`);
        }
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
