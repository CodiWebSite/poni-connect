import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    
    const { data: canManage } = await supabaseAdmin.rpc('can_manage_hr', { 
      _user_id: user.id 
    });
    
    if (!canManage) {
      throw new Error("Insufficient permissions");
    }

    // Get all users from auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const syncedEmails: string[] = [];
    let syncedCount = 0;

    for (const authUser of authUsers.users) {
      if (!authUser.email) continue;

      // Check if this email exists in employee_personal_data
      const { data: empData, error: empError } = await supabaseAdmin
        .from('employee_personal_data')
        .select('*')
        .eq('email', authUser.email.toLowerCase())
        .maybeSingle();

      if (empError || !empData) continue;

      // Check if already linked
      if (empData.employee_record_id) continue;

      // Update profile with employee data
      await supabaseAdmin
        .from('profiles')
        .update({
          full_name: `${empData.first_name} ${empData.last_name}`.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', authUser.id);

      // Create or get employee_record
      let recordId: string | null = null;
      
      const { data: existingRecord } = await supabaseAdmin
        .from('employee_records')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (existingRecord) {
        recordId = existingRecord.id;
        // Update hire date if not set
        await supabaseAdmin
          .from('employee_records')
          .update({ 
            hire_date: empData.employment_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', recordId);
      } else {
        const { data: newRecord } = await supabaseAdmin
          .from('employee_records')
          .insert({
            user_id: authUser.id,
            hire_date: empData.employment_date,
            contract_type: 'nedeterminat'
          })
          .select('id')
          .single();
        
        if (newRecord) {
          recordId = newRecord.id;
        }
      }

      // Link employee_personal_data to record
      if (recordId) {
        await supabaseAdmin
          .from('employee_personal_data')
          .update({ 
            employee_record_id: recordId,
            updated_at: new Date().toISOString()
          })
          .eq('id', empData.id);

        syncedEmails.push(empData.email);
        syncedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedCount,
        emails: syncedEmails,
        message: `Sincronizați ${syncedCount} angajați.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
