import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated and has HR permissions
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: canManage } = await supabaseAdmin.rpc("can_manage_hr", { _user_id: user.id });
    if (!canManage) throw new Error("Insufficient permissions");

    const { file_path } = await req.json();
    if (!file_path) throw new Error("file_path is required");

    // Download the CI scan from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("employee-documents")
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Determine mime type from extension
    const ext = file_path.split(".").pop()?.toLowerCase() || "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      pdf: "application/pdf",
    };
    const mimeType = mimeMap[ext] || "image/jpeg";

    console.log("Sending CI scan to AI for expiry date extraction...");

    // Call Lovable AI with vision to extract the expiry date
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Aceasta este o imagine cu o Carte de Identitate românească (buletin). 
Extrage DOAR data de expirare (valabilitate) de pe document.
Data de expirare apare de obicei lângă textul "Valabilitate" sau "Val." pe CI și este în format ZZ.LL.AAAA (ex: 03.08.2031).

Răspunde STRICT în format JSON astfel:
{"expiry_date": "YYYY-MM-DD", "confidence": "high"|"medium"|"low", "raw_text": "textul exact citit de pe CI"}

Dacă nu poți citi data de expirare, răspunde:
{"expiry_date": null, "confidence": "none", "raw_text": null, "error": "motivul"}

Nu adăuga alte explicații, doar JSON-ul.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI extraction failed");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response:", content);

    // Parse the JSON response from AI
    let result;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nu s-a putut interpreta răspunsul AI. Introduceți data manual.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        expiry_date: result.expiry_date,
        confidence: result.confidence,
        raw_text: result.raw_text,
        error: result.error || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Extract CI error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
