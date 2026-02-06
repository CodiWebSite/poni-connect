import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the requesting user is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nu ești autentificat" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    // Get the requesting user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Nu ești autentificat" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requesting user is super_admin
    const { data: roleData } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (!roleData || roleData.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Nu ai permisiuni de administrator" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "ID utilizator lipsă" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (userId === requestingUser.id) {
      return new Response(JSON.stringify({ error: "Nu îți poți șterge propriul cont" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up related data before deleting auth user
    // Order matters due to foreign key constraints

    // 1. Delete notifications
    await supabaseAuth.from("notifications").delete().eq("user_id", userId);

    // 2. Delete HR requests
    await supabaseAuth.from("hr_requests").delete().eq("user_id", userId);

    // 3. Delete employee documents
    await supabaseAuth.from("employee_documents").delete().eq("user_id", userId);

    // 4. Unlink employee_personal_data from employee_records
    const { data: empRecord } = await supabaseAuth
      .from("employee_records")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (empRecord) {
      await supabaseAuth
        .from("employee_personal_data")
        .update({ employee_record_id: null })
        .eq("employee_record_id", empRecord.id);
    }

    // 5. Delete employee records
    await supabaseAuth.from("employee_records").delete().eq("user_id", userId);

    // 6. Delete procurement requests
    await supabaseAuth.from("procurement_requests").delete().eq("user_id", userId);

    // 7. Delete suggestions
    await supabaseAuth.from("suggestions").delete().eq("user_id", userId);

    // 8. Delete department_heads entries where this user is head
    await supabaseAuth.from("department_heads").delete().eq("head_user_id", userId);

    // 9. Delete user_roles
    await supabaseAuth.from("user_roles").delete().eq("user_id", userId);

    // 10. Delete profile
    await supabaseAuth.from("profiles").delete().eq("user_id", userId);

    // 11. Finally delete the auth user
    const { error: deleteError } = await supabaseAuth.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: `Eroare la ștergerea contului: ${deleteError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Contul a fost șters cu succes" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Eroare internă a serverului" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
