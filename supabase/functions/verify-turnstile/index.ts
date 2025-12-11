import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      console.error("Missing or invalid token");
      return new Response(
        JSON.stringify({ success: false, error: "Token lipsă" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!secretKey) {
      console.error("TURNSTILE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the token with Cloudflare
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const outcome = await result.json();
    console.log("Turnstile verification result:", outcome.success);

    if (outcome.success) {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("Turnstile verification failed:", outcome["error-codes"]);
      return new Response(
        JSON.stringify({ success: false, error: "Verificare CAPTCHA eșuată" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error verifying Turnstile:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Eroare la verificare" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
