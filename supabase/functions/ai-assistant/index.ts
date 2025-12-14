import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client with user's auth context
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { message, history = [] } = await req.json();
    console.log("Received message:", message);

    // Search knowledge base for relevant articles
    const searchTerms = message.toLowerCase().split(" ").filter((w: string) => w.length > 3);
    let kbContext = "";
    
    if (searchTerms.length > 0) {
      const { data: articles, error: kbError } = await supabase
        .from("knowledge_base")
        .select("title, content, category")
        .eq("is_published", true)
        .limit(5);

      if (!kbError && articles && articles.length > 0) {
        // Simple relevance matching
        const relevantArticles = articles.filter((article: any) => {
          const text = `${article.title} ${article.content}`.toLowerCase();
          return searchTerms.some((term: string) => text.includes(term));
        }).slice(0, 3);

        if (relevantArticles.length > 0) {
          kbContext = "\n\nInformații relevante din Knowledge Base:\n" + 
            relevantArticles.map((a: any) => 
              `---\nTitlu: ${a.title}\nCategorie: ${a.category}\nConținut: ${a.content}\n---`
            ).join("\n");
        }
      }
    }

    console.log("KB context found:", kbContext ? "Yes" : "No");

    const systemPrompt = `Ești un asistent AI pentru intranetul Institutului de Chimie Macromoleculară "Petru Poni" Iași. 
Rolul tău este să ajuți angajații cu întrebări despre:
- Proceduri HR (concedii, adeverințe, delegații, demisii)
- Politici interne
- Procese administrative

Instrucțiuni:
- Răspunde întotdeauna în limba română
- Fii concis și profesionist
- Dacă găsești informații relevante în Knowledge Base, folosește-le în răspuns
- Dacă nu știi răspunsul, sugerează să contacteze departamentul HR
- Nu inventa informații care nu sunt în context${kbContext}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    console.log("Calling Lovable AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limita de cereri a fost depășită. Încercați din nou mai târziu." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credite insuficiente. Contactați administratorul." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "Nu am putut genera un răspuns.";
    
    console.log("AI response received successfully");

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-assistant function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Eroare necunoscută" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
