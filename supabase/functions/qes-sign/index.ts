import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// QES Provider configurations
interface QESConfig {
  provider: 'certsign' | 'digisign';
  apiUrl: string;
  apiKey: string;
  apiSecret?: string;
}

interface SignRequest {
  documentId: string;
  documentType: 'hr_request' | 'procurement';
  signerEmail: string;
  signerName: string;
  reason: string;
  provider: 'certsign' | 'digisign';
}

// certSIGN DocumentS@gn API integration
async function signWithCertSign(
  documentContent: string,
  signerEmail: string,
  signerName: string,
  reason: string,
  config: QESConfig
): Promise<{ success: boolean; signatureId?: string; signedDocument?: string; error?: string }> {
  console.log('Initiating certSIGN signing process...');
  
  const CERTSIGN_API_KEY = Deno.env.get('CERTSIGN_API_KEY');
  const CERTSIGN_API_SECRET = Deno.env.get('CERTSIGN_API_SECRET');
  
  if (!CERTSIGN_API_KEY || !CERTSIGN_API_SECRET) {
    return { 
      success: false, 
      error: 'Credențialele certSIGN nu sunt configurate. Contactați administratorul.' 
    };
  }

  try {
    // certSIGN DocumentS@gn API endpoint
    // Documentation: https://www.certsign.ro/certsign/resurse/docusign/api
    const apiUrl = 'https://api.certsign.ro/documentsign/v1';
    
    // Step 1: Create signing session
    const sessionResponse = await fetch(`${apiUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CERTSIGN_API_KEY,
        'X-API-Secret': CERTSIGN_API_SECRET,
      },
      body: JSON.stringify({
        document: {
          content: documentContent, // Base64 encoded PDF
          name: 'document.pdf',
          mimeType: 'application/pdf'
        },
        signers: [{
          email: signerEmail,
          name: signerName,
          signatureReason: reason,
          signatureLocation: 'Iași, România'
        }],
        callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/qes-callback`,
        expiresIn: 86400 // 24 hours
      })
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('certSIGN API error:', errorText);
      return { success: false, error: `Eroare API certSIGN: ${sessionResponse.status}` };
    }

    const sessionData = await sessionResponse.json();
    console.log('certSIGN session created:', sessionData.sessionId);

    return {
      success: true,
      signatureId: sessionData.sessionId,
      // The actual signed document will be returned via callback
    };
  } catch (err) {
    const error = err as Error;
    console.error('certSIGN signing error:', error);
    return { success: false, error: `Eroare la semnare: ${error.message}` };
  }
}

// DigiSign API integration
async function signWithDigiSign(
  documentContent: string,
  signerEmail: string,
  signerName: string,
  reason: string,
  config: QESConfig
): Promise<{ success: boolean; signatureId?: string; signingUrl?: string; error?: string }> {
  console.log('Initiating DigiSign signing process...');
  
  const DIGISIGN_API_KEY = Deno.env.get('DIGISIGN_API_KEY');
  const DIGISIGN_API_SECRET = Deno.env.get('DIGISIGN_API_SECRET');
  
  if (!DIGISIGN_API_KEY || !DIGISIGN_API_SECRET) {
    return { 
      success: false, 
      error: 'Credențialele DigiSign nu sunt configurate. Contactați administratorul.' 
    };
  }

  try {
    // DigiSign API endpoint
    // Documentation: https://www.digisign.ro/api-documentation
    const apiUrl = 'https://api.digisign.ro/v2';
    
    // Step 1: Authenticate and get token
    const authResponse = await fetch(`${apiUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: DIGISIGN_API_KEY,
        apiSecret: DIGISIGN_API_SECRET,
      })
    });

    if (!authResponse.ok) {
      return { success: false, error: 'Autentificare DigiSign eșuată' };
    }

    const { accessToken } = await authResponse.json();

    // Step 2: Create document for signing
    const documentResponse = await fetch(`${apiUrl}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        document: {
          content: documentContent,
          fileName: 'document.pdf',
          contentType: 'application/pdf'
        },
        workflow: {
          type: 'sequential',
          signers: [{
            email: signerEmail,
            name: signerName,
            signatureType: 'qualified', // QES - qualified electronic signature
            reason: reason,
            location: 'Iași, România'
          }]
        },
        notifications: {
          webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/qes-callback`,
          emailNotifications: true
        }
      })
    });

    if (!documentResponse.ok) {
      const errorText = await documentResponse.text();
      console.error('DigiSign API error:', errorText);
      return { success: false, error: `Eroare API DigiSign: ${documentResponse.status}` };
    }

    const docData = await documentResponse.json();
    console.log('DigiSign document created:', docData.documentId);

    return {
      success: true,
      signatureId: docData.documentId,
      signingUrl: docData.signingUrl, // URL where user will sign
    };
  } catch (err) {
    const error = err as Error;
    console.error('DigiSign signing error:', error);
    return { success: false, error: `Eroare la semnare: ${error.message}` };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autentificare necesară' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Utilizator neautentificat' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = await req.json();
    console.log('QES action:', action, 'from user:', user.email);

    switch (action) {
      case 'check-config': {
        // Check which providers are configured
        const certSignConfigured = !!(Deno.env.get('CERTSIGN_API_KEY') && Deno.env.get('CERTSIGN_API_SECRET'));
        const digiSignConfigured = !!(Deno.env.get('DIGISIGN_API_KEY') && Deno.env.get('DIGISIGN_API_SECRET'));
        
        return new Response(
          JSON.stringify({
            providers: {
              certsign: { configured: certSignConfigured, name: 'certSIGN' },
              digisign: { configured: digiSignConfigured, name: 'DigiSign' }
            },
            anyConfigured: certSignConfigured || digiSignConfigured
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'initiate-signing': {
        const { documentId, documentType, signerEmail, signerName, reason, provider, documentContent } = params as SignRequest & { documentContent: string };
        
        if (!documentId || !signerEmail || !provider || !documentContent) {
          return new Response(
            JSON.stringify({ error: 'Parametri lipsă' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let result;
        if (provider === 'certsign') {
          result = await signWithCertSign(documentContent, signerEmail, signerName, reason, {} as QESConfig);
        } else if (provider === 'digisign') {
          result = await signWithDigiSign(documentContent, signerEmail, signerName, reason, {} as QESConfig);
        } else {
          return new Response(
            JSON.stringify({ error: 'Furnizor necunoscut' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (result.success) {
          // Store signing session in database for tracking
          // This would be used when the callback arrives
          console.log(`Signing initiated for document ${documentId} with ${provider}`);
        }

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-signing-status': {
        const { signatureId, provider } = params;
        
        // Check status with the provider
        // This would query the provider's API for the current status
        
        return new Response(
          JSON.stringify({ 
            status: 'pending',
            message: 'Semnătura este în curs de procesare'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Acțiune necunoscută' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (err) {
    const error = err as Error;
    console.error('QES function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Eroare internă' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
