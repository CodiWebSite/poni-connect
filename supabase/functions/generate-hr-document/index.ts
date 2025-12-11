import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HRRequestBody {
  requestType: 'concediu' | 'adeverinta' | 'delegatie' | 'demisie';
  details: {
    startDate?: string;
    endDate?: string;
    reason?: string;
    purpose?: string;
    destination?: string;
    employeeName: string;
    department: string;
    position: string;
  };
}

const getSystemPrompt = (requestType: string) => {
  const prompts: Record<string, string> = {
    concediu: `Ești un expert în resurse umane pentru Institutul de Chimie Macromoleculară "Petru Poni" Iași. 
Generează o cerere de concediu profesională în limba română, formatată corespunzător pentru un document oficial.
Include: antet instituție, data, către (Conducerea institutului), corpul cererii cu detalii despre perioada solicitată și motivul, 
formula de încheiere, semnătură și dată. Folosește un ton formal și profesionist.`,
    
    adeverinta: `Ești un expert în resurse umane pentru Institutul de Chimie Macromoleculară "Petru Poni" Iași.
Generează o adeverință profesională în limba română, formatată corespunzător pentru un document oficial.
Include: antet instituție cu date de contact, număr de înregistrare, titlu "ADEVERINȚĂ", 
corpul documentului care certifică calitatea de angajat, funcția, departamentul, 
formula "Eliberată pentru a-i servi la...", semnături și ștampilă.`,
    
    delegatie: `Ești un expert în resurse umane pentru Institutul de Chimie Macromoleculară "Petru Poni" Iași.
Generează un ordin de delegație profesional în limba română, formatat corespunzător pentru un document oficial.
Include: antet instituție, număr și dată, titlu "ORDIN DE DELEGAȚIE", 
detalii despre delegat (nume, funcție), destinație, perioadă, scopul delegației, 
mijlocul de transport, semnături autorizate.`,
    
    demisie: `Ești un expert în resurse umane pentru Institutul de Chimie Macromoleculară "Petru Poni" Iași.
Generează o cerere de demisie profesională în limba română, formatată corespunzător pentru un document oficial.
Include: antet, data, către (Conducerea institutului), corpul cererii cu menționarea 
perioadei de preaviz conform legislației muncii, formula de încheiere politicoasă, semnătură.`
  };
  
  return prompts[requestType] || prompts.adeverinta;
};

const getUserPrompt = (requestType: string, details: HRRequestBody['details']) => {
  const { employeeName, department, position, startDate, endDate, reason, purpose, destination } = details;
  
  switch (requestType) {
    case 'concediu':
      return `Generează o cerere de concediu pentru:
- Angajat: ${employeeName}
- Departament: ${department}
- Funcție: ${position}
- Perioada: ${startDate} - ${endDate}
- Motiv: ${reason || 'concediu de odihnă'}

Generează documentul complet, gata de semnat.`;

    case 'adeverinta':
      return `Generează o adeverință pentru:
- Angajat: ${employeeName}
- Departament: ${department}
- Funcție: ${position}
- Scopul adeverinței: ${purpose || 'uzul personal'}

Generează documentul complet cu toate elementele necesare.`;

    case 'delegatie':
      return `Generează un ordin de delegație pentru:
- Angajat: ${employeeName}
- Departament: ${department}
- Funcție: ${position}
- Destinația: ${destination || 'nu este specificată'}
- Perioada: ${startDate} - ${endDate}
- Scopul: ${purpose || 'nu este specificat'}

Generează documentul complet.`;

    case 'demisie':
      return `Generează o cerere de demisie pentru:
- Angajat: ${employeeName}
- Departament: ${department}
- Funcție: ${position}
- Motiv (opțional): ${reason || 'motive personale'}

Generează documentul complet, respectând perioada legală de preaviz.`;

    default:
      return `Generează un document HR pentru ${employeeName}.`;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { requestType, details }: HRRequestBody = await req.json();
    
    console.log("Generating HR document:", requestType, details);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: getSystemPrompt(requestType) },
          { role: "user", content: getUserPrompt(requestType, details) }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content;

    if (!generatedContent) {
      throw new Error("No content generated");
    }

    console.log("Document generated successfully");

    return new Response(
      JSON.stringify({ content: generatedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating HR document:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
