import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Employee {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  birth_date: string | null;
}

interface EmployeeRecord {
  user_id: string;
  hire_date: string | null;
  contract_type: string | null;
  total_leave_days: number;
  used_leave_days: number;
}

// Generate UUID for REGES messages
function generateUUID(): string {
  return crypto.randomUUID();
}

// Escape XML special characters
function escapeXml(str: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date for REGES (ISO format)
function formatDate(dateStr: string | null): string {
  if (!dateStr) return new Date().toISOString();
  return new Date(dateStr).toISOString();
}

// Map contract type to REGES format
function mapContractType(type: string | null): string {
  switch (type) {
    case 'nedeterminat':
      return 'Nedeterminata';
    case 'determinat':
      return 'Determinata';
    default:
      return 'Nedeterminata';
  }
}

// Generate XML for employee registration (InregistrareSalariat)
function generateEmployeeXml(employee: Employee, clientAppId: string, authorId: string, sessionId: string): string {
  const messageId = generateUUID();
  const timestamp = new Date().toISOString();
  
  // Split full name into parts
  const nameParts = employee.full_name.trim().split(' ');
  const nume = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
  const prenume = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Message xsi:type="Salariat" xmlns="http://www.inspectiamuncii.ro/reges2025"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://www.inspectiamuncii.ro/reges2025">
    <Header>
        <MessageId>${messageId}</MessageId>
        <ClientApplication>${escapeXml(clientAppId) || 'ICMPP-INTRANET'}</ClientApplication>
        <Version>5</Version>
        <Operation>InregistrareSalariat</Operation>
        <AuthorId>${escapeXml(authorId) || generateUUID()}</AuthorId>
        <SessionId>${escapeXml(sessionId) || generateUUID()}</SessionId>
        <User>HR-System</User>
        <Timestamp>${timestamp}</Timestamp>
    </Header>
    <Info>
        <Adresa><!-- COMPLETAȚI ADRESA --></Adresa>
        <Cnp><!-- COMPLETAȚI CNP --></Cnp>
        <Nume>${escapeXml(nume.toUpperCase())}</Nume>
        <Prenume>${escapeXml(prenume.toUpperCase())}</Prenume>
        <Nationalitate>
            <Nume>ROMÂNIA</Nume>
        </Nationalitate>
        <TaraDomiciliu>
            <Nume>ROMÂNIA</Nume>
        </TaraDomiciliu>
        <TipActIdentitate>CarteIdentitate</TipActIdentitate>
    </Info>
</Message>`;
}

// Generate XML for contract registration (AdaugareContract)
function generateContractXml(
  employee: Employee, 
  record: EmployeeRecord | null,
  clientAppId: string,
  authorId: string,
  sessionId: string,
  salariatId: string
): string {
  const messageId = generateUUID();
  const timestamp = new Date().toISOString();
  const contractDate = record?.hire_date ? formatDate(record.hire_date) : timestamp;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Message xsi:type="Contract" xmlns="http://www.inspectiamuncii.ro/reges2025"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://www.inspectiamuncii.ro/reges2025">
    <Header>
        <MessageId>${messageId}</MessageId>
        <ClientApplication>${escapeXml(clientAppId) || 'ICMPP-INTRANET'}</ClientApplication>
        <Version>5</Version>
        <Operation>AdaugareContract</Operation>
        <AuthorId>${escapeXml(authorId) || generateUUID()}</AuthorId>
        <SessionId>${escapeXml(sessionId) || generateUUID()}</SessionId>
        <User>HR-System</User>
        <Timestamp>${timestamp}</Timestamp>
    </Header>
    <Continut>
        <ReferintaSalariat>
            <Id>${escapeXml(salariatId) || '<!-- COMPLETAȚI ID SALARIAT REGES -->'}</Id>
        </ReferintaSalariat>
        <Cor>
            <Cod><!-- COMPLETAȚI COD COR --></Cod>
            <Versiune>10</Versiune>
        </Cor>
        <DataConsemnare>${timestamp}</DataConsemnare>
        <DataContract>${contractDate}</DataContract>
        <DataInceputContract>${contractDate}</DataInceputContract>
        <NumarContract><!-- COMPLETAȚI NUMĂR CONTRACT --></NumarContract>
        <Radiat>false</Radiat>
        <Salariu><!-- COMPLETAȚI SALARIU --></Salariu>
        <StareCurenta>
        </StareCurenta>
        <TimpMunca>
            <Norma>NormaIntreaga840</Norma>
            <Repartizare>OreDeZi</Repartizare>
        </TimpMunca>
        <TipContract>ContractIndividualMunca</TipContract>
        <TipDurata>${mapContractType(record?.contract_type || null)}</TipDurata>
        <TipNorma>NormaIntreaga</TipNorma>
    </Continut>
</Message>`;
}

// Generate XML for suspension (ActiuneSuspendare - for leave)
function generateSuspensionXml(
  contractId: string,
  startDate: string,
  endDate: string,
  reason: string,
  clientAppId: string,
  authorId: string,
  sessionId: string
): string {
  const messageId = generateUUID();
  const timestamp = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<Message xsi:type="Contract" xmlns="http://www.inspectiamuncii.ro/reges2025"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://www.inspectiamuncii.ro/reges2025">
    <Header>
        <MessageId>${messageId}</MessageId>
        <ClientApplication>${escapeXml(clientAppId) || 'ICMPP-INTRANET'}</ClientApplication>
        <Version>5</Version>
        <Operation>ModificareContract</Operation>
        <AuthorId>${escapeXml(authorId) || generateUUID()}</AuthorId>
        <SessionId>${escapeXml(sessionId) || generateUUID()}</SessionId>
        <User>HR-System</User>
        <Timestamp>${timestamp}</Timestamp>
    </Header>
    <ReferintaContract>
        <Id>${escapeXml(contractId) || '<!-- COMPLETAȚI ID CONTRACT REGES -->'}</Id>
    </ReferintaContract>
    <Actiune xsi:type="ActiuneSuspendare">
        <DataInceput>${formatDate(startDate)}</DataInceput>
        <DataSfarsit>${formatDate(endDate)}</DataSfarsit>
        <TemeiLegal>Art51Alin1LitA</TemeiLegal>
        <Explicatie>${escapeXml(reason) || 'Concediu de odihnă'}</Explicatie>
    </Actiune>
</Message>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { type, employeeIds, leaveRequests, config } = await req.json();
    
    const clientAppId = config?.clientAppId || 'ICMPP-INTRANET';
    const authorId = config?.authorId || '';
    const sessionId = config?.sessionId || generateUUID();

    console.log(`Generating REGES XML for type: ${type}, employees: ${employeeIds?.length || 0}`);

    // Fetch employees
    let employees: Employee[] = [];
    let records: EmployeeRecord[] = [];

    if (employeeIds && employeeIds.length > 0) {
      const { data: profilesData } = await supabaseClient
        .from('profiles')
        .select('user_id, full_name, department, position, phone, birth_date')
        .in('user_id', employeeIds);
      
      employees = profilesData || [];

      const { data: recordsData } = await supabaseClient
        .from('employee_records')
        .select('*')
        .in('user_id', employeeIds);
      
      records = recordsData || [];
    }

    let xmlMessages: { type: string; employeeName: string; xml: string }[] = [];

    switch (type) {
      case 'employees':
        // Generate employee registration XMLs
        for (const emp of employees) {
          const xml = generateEmployeeXml(emp, clientAppId, authorId, sessionId);
          xmlMessages.push({
            type: 'InregistrareSalariat',
            employeeName: emp.full_name,
            xml
          });
        }
        break;

      case 'contracts':
        // Generate contract XMLs
        for (const emp of employees) {
          const record = records.find(r => r.user_id === emp.user_id);
          const xml = generateContractXml(emp, record || null, clientAppId, authorId, sessionId, '');
          xmlMessages.push({
            type: 'AdaugareContract',
            employeeName: emp.full_name,
            xml
          });
        }
        break;

      case 'suspensions':
        // Generate suspension XMLs for leave requests
        if (leaveRequests && leaveRequests.length > 0) {
          for (const leave of leaveRequests) {
            const xml = generateSuspensionXml(
              leave.contractId || '',
              leave.startDate,
              leave.endDate,
              leave.reason || 'Concediu de odihnă',
              clientAppId,
              authorId,
              sessionId
            );
            xmlMessages.push({
              type: 'ActiuneSuspendare',
              employeeName: leave.employeeName || 'N/A',
              xml
            });
          }
        }
        break;

      case 'batch':
        // Generate all XMLs for selected employees
        for (const emp of employees) {
          // Employee registration
          const empXml = generateEmployeeXml(emp, clientAppId, authorId, sessionId);
          xmlMessages.push({
            type: 'InregistrareSalariat',
            employeeName: emp.full_name,
            xml: empXml
          });

          // Contract
          const record = records.find(r => r.user_id === emp.user_id);
          const contractXml = generateContractXml(emp, record || null, clientAppId, authorId, sessionId, '');
          xmlMessages.push({
            type: 'AdaugareContract',
            employeeName: emp.full_name,
            xml: contractXml
          });
        }
        break;

      default:
        throw new Error(`Unknown export type: ${type}`);
    }

    console.log(`Generated ${xmlMessages.length} XML messages`);

    return new Response(
      JSON.stringify({
        success: true,
        count: xmlMessages.length,
        messages: xmlMessages,
        timestamp: new Date().toISOString(),
        note: 'Completați câmpurile marcate cu <!-- COMPLETAȚI --> înainte de transmitere'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('REGES XML generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
