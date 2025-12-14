import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid request types
const VALID_REQUEST_TYPES = ['concediu', 'adeverinta', 'delegatie', 'demisie'] as const;
type RequestType = typeof VALID_REQUEST_TYPES[number];

interface HRRequestDetails {
  startDate?: string;
  endDate?: string;
  reason?: string;
  purpose?: string;
  destination?: string;
  employeeName: string;
  department: string;
  position: string;
  numberOfDays?: number;
  year?: string;
  replacementName?: string;
  replacementPosition?: string;
}

interface HRRequestBody {
  requestType: RequestType;
  details: HRRequestDetails;
}

// Input validation function
function validateInput(body: unknown): { valid: true; data: HRRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object' };
  }

  const { requestType, details } = body as Record<string, unknown>;

  // Validate requestType
  if (!requestType || typeof requestType !== 'string') {
    return { valid: false, error: 'requestType is required and must be a string' };
  }

  if (!VALID_REQUEST_TYPES.includes(requestType as RequestType)) {
    return { valid: false, error: `Invalid requestType. Must be one of: ${VALID_REQUEST_TYPES.join(', ')}` };
  }

  // Validate details object
  if (!details || typeof details !== 'object') {
    return { valid: false, error: 'details is required and must be an object' };
  }

  const d = details as Record<string, unknown>;

  // Required fields
  if (!d.employeeName || typeof d.employeeName !== 'string' || d.employeeName.trim().length === 0) {
    return { valid: false, error: 'details.employeeName is required and must be a non-empty string' };
  }

  if (!d.department || typeof d.department !== 'string' || d.department.trim().length === 0) {
    return { valid: false, error: 'details.department is required and must be a non-empty string' };
  }

  if (!d.position || typeof d.position !== 'string' || d.position.trim().length === 0) {
    return { valid: false, error: 'details.position is required and must be a non-empty string' };
  }

  // String length limits to prevent abuse
  const MAX_STRING_LENGTH = 500;
  const stringFields = ['employeeName', 'department', 'position', 'reason', 'purpose', 'destination', 'year', 'replacementName', 'replacementPosition'];
  
  for (const field of stringFields) {
    const value = d[field];
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        return { valid: false, error: `details.${field} must be a string` };
      }
      if (value.length > MAX_STRING_LENGTH) {
        return { valid: false, error: `details.${field} exceeds maximum length of ${MAX_STRING_LENGTH} characters` };
      }
    }
  }

  // Validate date format (YYYY-MM-DD) if provided
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (d.startDate !== undefined && d.startDate !== null) {
    if (typeof d.startDate !== 'string' || !dateRegex.test(d.startDate)) {
      return { valid: false, error: 'details.startDate must be in YYYY-MM-DD format' };
    }
  }

  if (d.endDate !== undefined && d.endDate !== null) {
    if (typeof d.endDate !== 'string' || !dateRegex.test(d.endDate)) {
      return { valid: false, error: 'details.endDate must be in YYYY-MM-DD format' };
    }
  }

  // Validate numberOfDays if provided
  if (d.numberOfDays !== undefined && d.numberOfDays !== null) {
    if (typeof d.numberOfDays !== 'number' || d.numberOfDays < 1 || d.numberOfDays > 365) {
      return { valid: false, error: 'details.numberOfDays must be a number between 1 and 365' };
    }
  }

  // Sanitize string inputs
  const sanitizedDetails: HRRequestDetails = {
    employeeName: String(d.employeeName).trim().slice(0, MAX_STRING_LENGTH),
    department: String(d.department).trim().slice(0, MAX_STRING_LENGTH),
    position: String(d.position).trim().slice(0, MAX_STRING_LENGTH),
    startDate: d.startDate ? String(d.startDate).trim() : undefined,
    endDate: d.endDate ? String(d.endDate).trim() : undefined,
    reason: d.reason ? String(d.reason).trim().slice(0, MAX_STRING_LENGTH) : undefined,
    purpose: d.purpose ? String(d.purpose).trim().slice(0, MAX_STRING_LENGTH) : undefined,
    destination: d.destination ? String(d.destination).trim().slice(0, MAX_STRING_LENGTH) : undefined,
    numberOfDays: d.numberOfDays as number | undefined,
    year: d.year ? String(d.year).trim().slice(0, 4) : undefined,
    replacementName: d.replacementName ? String(d.replacementName).trim().slice(0, MAX_STRING_LENGTH) : undefined,
    replacementPosition: d.replacementPosition ? String(d.replacementPosition).trim().slice(0, MAX_STRING_LENGTH) : undefined,
  };

  return {
    valid: true,
    data: {
      requestType: requestType as RequestType,
      details: sanitizedDetails,
    },
  };
}

// For concediu, we use the template-based document, not AI generation
const generateLeaveRequestData = (details: HRRequestDetails) => {
  const startDate = details.startDate ? new Date(details.startDate) : null;
  const endDate = details.endDate ? new Date(details.endDate) : null;
  
  let numberOfDays = details.numberOfDays || 0;
  if (startDate && endDate && !numberOfDays) {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    numberOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  return {
    type: 'concediu',
    templateData: {
      employeeName: details.employeeName,
      position: details.position,
      department: details.department,
      numberOfDays,
      year: details.year || new Date().getFullYear().toString(),
      startDate: details.startDate,
      endDate: details.endDate,
      replacementName: details.replacementName || '',
      replacementPosition: details.replacementPosition || ''
    }
  };
};

const getSystemPrompt = (requestType: string) => {
  const prompts: Record<string, string> = {
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

const getUserPrompt = (requestType: string, details: HRRequestDetails) => {
  const { employeeName, department, position, startDate, endDate, reason, purpose, destination } = details;
  
  switch (requestType) {
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

    console.log("Authenticated user:", user.id, "generating HR document");

    // Parse and validate input
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      console.error("Invalid JSON in request body");
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = validateInput(rawBody);
    if (!validation.valid) {
      console.error("Validation error:", validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { requestType, details } = validation.data;
    
    console.log("Generating HR document:", requestType, "for:", details.employeeName);

    // For leave requests, return structured data for template rendering
    if (requestType === 'concediu') {
      const result = generateLeaveRequestData(details);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For other document types, use AI generation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    console.log("Document generated successfully for:", details.employeeName);

    return new Response(
      JSON.stringify({ type: requestType, content: generatedContent }),
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
