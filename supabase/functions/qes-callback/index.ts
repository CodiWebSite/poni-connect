import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This endpoint receives callbacks from QES providers when signing is complete
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('QES callback received:', JSON.stringify(payload));

    // Determine which provider sent the callback
    const provider = payload.provider || detectProvider(payload);
    
    switch (provider) {
      case 'certsign': {
        // Handle certSIGN callback
        const { sessionId, status, signedDocument, signerEmail } = payload;
        
        if (status === 'completed' && signedDocument) {
          console.log(`certSIGN signing completed for session ${sessionId}`);
          
          // Update the HR request with the qualified signature
          // Store the signed document
          await updateDocumentWithQES(supabase, sessionId, signedDocument, 'certsign');
          
          // Notify user
          await notifySigningComplete(supabase, sessionId, signerEmail, 'certsign');
        } else if (status === 'failed' || status === 'expired') {
          console.error(`certSIGN signing failed for session ${sessionId}: ${payload.error}`);
          await notifySigningFailed(supabase, sessionId, payload.error);
        }
        break;
      }
      
      case 'digisign': {
        // Handle DigiSign callback
        const { documentId, event, signedPdf, signer } = payload;
        
        if (event === 'document.signed' && signedPdf) {
          console.log(`DigiSign signing completed for document ${documentId}`);
          
          await updateDocumentWithQES(supabase, documentId, signedPdf, 'digisign');
          await notifySigningComplete(supabase, documentId, signer?.email, 'digisign');
        } else if (event === 'document.rejected' || event === 'document.expired') {
          console.error(`DigiSign signing failed for document ${documentId}`);
          await notifySigningFailed(supabase, documentId, payload.reason);
        }
        break;
      }
      
      default:
        console.warn('Unknown provider callback:', payload);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('QES callback error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function detectProvider(payload: any): string {
  // Detect provider based on callback structure
  if (payload.sessionId && payload.certsign) return 'certsign';
  if (payload.documentId && payload.digisign) return 'digisign';
  return 'unknown';
}

async function updateDocumentWithQES(
  supabase: any, 
  signatureId: string, 
  signedDocument: string,
  provider: string
) {
  // This would update the HR request with the qualified signature
  // The signedDocument is a Base64 encoded PDF with the qualified signature embedded
  console.log(`Updating document ${signatureId} with QES from ${provider}`);
  
  // In a real implementation, you would:
  // 1. Find the associated HR request by the signature ID stored during initiation
  // 2. Store the signed PDF in Supabase Storage
  // 3. Update the hr_requests table with the signed document URL and QES metadata
}

async function notifySigningComplete(
  supabase: any,
  signatureId: string,
  signerEmail: string,
  provider: string
) {
  console.log(`Notifying user ${signerEmail} about completed signing`);
  
  // Create notification for the user
  // Find user by email and create notification
}

async function notifySigningFailed(
  supabase: any,
  signatureId: string,
  error: string
) {
  console.log(`Signing failed for ${signatureId}: ${error}`);
  
  // Create failure notification
}
