import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKETS = ["avatars", "documents", "employee-documents", "secretariat-documents", "announcement-attachments", "email-assets"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleData?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List all files from all buckets
    const result: { bucket: string; files: { name: string; url: string; size?: number }[] }[] = [];
    let totalFiles = 0;

    for (const bucket of BUCKETS) {
      try {
        const allFiles: { name: string; url: string; size?: number }[] = [];

        // List root level files
        const { data: rootFiles, error: listError } = await supabase.storage
          .from(bucket)
          .list("", { limit: 1000 });

        if (listError) {
          console.error(`Error listing bucket ${bucket}:`, listError.message);
          result.push({ bucket, files: [] });
          continue;
        }

        // Process files and folders
        const processItems = async (items: any[], prefix: string) => {
          for (const item of items) {
            const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

            if (item.id) {
              // It's a file
              const { data: signedData } = await supabase.storage
                .from(bucket)
                .createSignedUrl(fullPath, 3600); // 1 hour expiry

              if (signedData?.signedUrl) {
                allFiles.push({
                  name: fullPath,
                  url: signedData.signedUrl,
                  size: item.metadata?.size || undefined,
                });
              }
            } else {
              // It's a folder - recurse
              const { data: subItems } = await supabase.storage
                .from(bucket)
                .list(fullPath, { limit: 1000 });

              if (subItems) {
                await processItems(subItems, fullPath);
              }
            }
          }
        };

        await processItems(rootFiles || [], "");
        totalFiles += allFiles.length;
        result.push({ bucket, files: allFiles });
      } catch (err) {
        console.error(`Error processing bucket ${bucket}:`, err);
        result.push({ bucket, files: [] });
      }
    }

    return new Response(
      JSON.stringify({
        metadata: {
          created_at: new Date().toISOString(),
          total_files: totalFiles,
          buckets: BUCKETS.length,
        },
        buckets: result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
