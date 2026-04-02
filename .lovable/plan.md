

# IRIS v2 — Copilot Operațional ICMPP

## Rezumat
Transformarea IRIS din asistent read-only într-un copilot operațional cu două moduri: **Read Mode** (existent, îmbunătățit) și **Action Mode** (nou — execută acțiuni asistate cu confirmare). Implementare bazată pe AI tool-calling: modelul AI detectează intenția și apelează funcții specifice prin mecanismul `tools` al API-ului, iar frontend-ul afișează carduri de confirmare înainte de execuție.

## Arhitectura tool-calling

```text
Utilizator → mesaj → Edge Function → AI Gateway (cu tools definite)
                                         ↓
                                    AI returnează tool_call
                                         ↓
                              Edge Function execută tool-ul
                              (validare rol, date, duplicate)
                                         ↓
                              Returnează rezultat → AI formulează răspuns
                                         ↓
                              Stream către client
                              (cu acțiuni ce necesită confirmare)
```

Pentru acțiuni write, fluxul este în 2 pași:
1. AI pregătește acțiunea și returnează un bloc `[IRIS_ACTION]` cu datele
2. Frontend afișează card de confirmare → utilizatorul confirmă → se trimite mesaj de confirmare → Edge Function execută

## Detalii tehnice

### Fișiere noi

#### `supabase/functions/_shared/iris-tools/leave.ts`
Funcții pentru concedii:
- `check_leave_balance(userId)` — sold, report, bonus
- `check_leave_overlaps(userId, startDate, endDate)` — suprapuneri
- `calculate_working_days(startDate, endDate)` — zile lucrătoare (excluzând weekend + sărbători)
- `find_approver(userId)` — aprobator desemnat (per-employee → per-department fallback)
- `create_leave_request(userId, startDate, endDate, replacementName, ip)` — inserare cu validări complete + audit
- `get_pending_approvals(userId, userRole)` — cereri de aprobat (pt șefi/HR)
- `get_team_on_leave(department, dateRange)` — cine e în concediu

#### `supabase/functions/_shared/iris-tools/requests.ts`
- `create_correction_request(userId, fieldName, currentValue, requestedValue, reason)` — cerere corecție date
- `create_helpdesk_ticket(name, email, subject, message)` — tichet HelpDesk
- `create_hr_request(userId, requestType, details)` — cerere adeverință/alte

#### `supabase/functions/_shared/iris-tools/hr.ts`
Funcții HR (doar pt roluri hr/sef_srus/super_admin):
- `get_employee_summary(employeeName, requestingUserRole)` — rezumat pe angajat (documente, sold, cereri)
- `get_expiring_documents(days)` — documente CI ce expiră
- `get_employees_without_accounts()` — angajați fără cont

#### `supabase/functions/_shared/iris-tools/audit.ts`
- `log_iris_action(userId, action, entityType, entityId, details, ip)` — logare audit cu marcaj `initiated_via: iris`

#### `supabase/functions/_shared/iris-tools/system.ts`
Funcții super_admin:
- `get_system_summary()` — rezumat operațional (health, cereri noi, tichete, utilizatori fără rol)

#### `src/components/iris/IrisConfirmationCard.tsx`
Card interactiv afișat în chat când IRIS pregătește o acțiune:
- Titlu acțiune (ex: "Cerere concediu de odihnă")
- Rezumat detalii (date, zile, aprobator)
- Butoane: "Confirmă" / "Anulează"
- Badge "v2 — Action Mode"
- La confirmare, trimite mesaj automat cu payload-ul acțiunii

#### `src/components/iris/IrisActionPreview.tsx`
Componentă simplă ce afișează rezultatul unei acțiuni executate:
- Status: succes/eroare
- Detalii (număr cerere, link către pagina relevantă)
- Timestamp + marcaj "Acțiune executată prin IRIS"

### Fișiere modificate

#### `supabase/functions/iris-chat/index.ts` — rescris major
Schimbări principale:
1. **Tool-calling**: Definirea tools-urilor AI (check_leave_balance, create_leave_request, create_helpdesk_ticket, etc.) ca funcții în payload-ul către AI Gateway
2. **Flux confirmare**: Când AI decide o acțiune write, returnează un bloc JSON special `[IRIS_ACTION:{...}]` în răspuns
3. **Endpoint de execuție**: Acceptă un nou câmp `executeAction` în request body — când clientul trimite confirmarea, edge function-ul execută acțiunea reală
4. **Extragere IP**: Din header-ele `x-forwarded-for` / `CF-Connecting-IP` pentru audit
5. **Context îmbunătățit**: Include informații despre carryover, bonus days, employee_personal_data ID
6. **System prompt v2**: Include instrucțiuni pentru modul Action (când să propună acțiuni, cum să ceară confirmare)
7. **Validare rol pentru tools**: Fiecare tool verifică dacă rolul utilizatorului permite acțiunea

Structura non-streaming pentru execuție acțiuni:
```text
POST /iris-chat
Body: { executeAction: { type: "create_leave", data: {...} } }
Response: { success: true, result: { requestNumber: "CO-2026-0042" } }
```

Structura streaming pentru chat normal rămâne neschimbată.

#### `src/components/iris/IrisChatPanel.tsx`
- Parsare blocuri `[IRIS_ACTION:{...}]` din stream-ul AI
- Afișare `IrisConfirmationCard` în loc de text simplu pentru acțiuni
- Handler de confirmare: trimite `executeAction` către edge function
- Handler de anulare: adaugă mesaj "Acțiunea a fost anulată"
- Afișare `IrisActionPreview` după execuție reușită

#### `src/components/iris/IrisQuickActions.tsx`
Sugestii noi adaptate v2:
- **Toți**: + "Depune o cerere de concediu", "Raportează o problemă"
- **Șefi**: + "Arată aprobările mele în așteptare", "Cine e în concediu azi?"
- **HR**: + "Rezumat pe angajatul X", "Documente ce expiră luna aceasta"
- **super_admin**: + "Rezumat operațional zilnic"

#### `src/components/iris/IrisContextHints.tsx`
Hint-uri actualizate pentru Action Mode:
- Pe `/leave-request`: "Pot crea cererea de concediu direct — spuneți-mi perioada!"
- Pe `/hr-management`: "Pot verifica dosarul oricărui angajat — întrebați-mă!"

#### `src/components/iris/IrisMessageBubble.tsx`
- Detectare blocuri `[IRIS_ACTION:{...}]` și `[IRIS_RESULT:{...}]` în content
- Rendering prin componentele IrisConfirmationCard / IrisActionPreview

## Tools AI definite în edge function

```typescript
const IRIS_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_leave_balance",
      description: "Verifică soldul de concediu al utilizatorului curent",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function", 
    function: {
      name: "prepare_leave_request",
      description: "Pregătește o cerere de concediu. Returnează rezumatul pentru confirmare.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Data început (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Data sfârșit (YYYY-MM-DD)" },
          replacement_name: { type: "string", description: "Nume înlocuitor (opțional)" }
        },
        required: ["start_date", "end_date"]
      }
    }
  },
  // ... similar pentru create_helpdesk_ticket, create_correction_request,
  //     get_employee_summary (HR only), get_pending_approvals, get_team_schedule
];
```

AI-ul va apela tool-urile, edge function-ul le execută (read sau prepare), iar pentru acțiuni write returnează un bloc de confirmare pe care frontend-ul îl afișează.

## Flux detaliat — Cerere concediu prin IRIS

1. User: "Vreau concediu 6-10 aprilie 2026"
2. AI apelează `prepare_leave_request(start_date, end_date)`
3. Edge function:
   - Calculează zile lucrătoare (excluzând weekend/sărbători)
   - Verifică sold suficient
   - Verifică duplicate/suprapuneri
   - Găsește aprobatorul
   - Returnează rezumat
4. AI formulează răspunsul cu bloc `[IRIS_ACTION:{"type":"create_leave","data":{...},"summary":"..."}]`
5. Frontend afișează IrisConfirmationCard
6. User apasă "Confirmă"
7. Frontend trimite `executeAction` către edge function
8. Edge function inserează în `leave_requests` + `notifications` + `audit_logs` (cu `initiated_via: iris`)
9. Returnează `[IRIS_RESULT:{"success":true,"requestNumber":"CO-2026-0042"}]`
10. Frontend afișează IrisActionPreview cu link către cerere

## Securitate

- Toate tool-urile write verifică rolul din JWT
- Tool-urile HR verifică `can_manage_hr(userId)` prin query pe `user_roles`
- Tool-urile super_admin verifică `role === 'super_admin'`
- IP-ul se extrage din headers pentru audit
- Fiecare acțiune logată cu: user_id, action, entity_type, entity_id, `{initiated_via: "iris", ip: "..."}`
- Nu se expun CNP, CI, adresă, telefon — niciodată
- Rolul `admin` nu este recunoscut

## Pași de implementare

1. Creare module `_shared/iris-tools/*.ts` (leave, requests, hr, audit, system)
2. Rescriere `iris-chat/index.ts` cu tool-calling + endpoint execuție
3. Creare `IrisConfirmationCard.tsx` și `IrisActionPreview.tsx`
4. Actualizare `IrisChatPanel.tsx` cu parsing acțiuni + flux confirmare
5. Actualizare `IrisMessageBubble.tsx` cu rendering blocuri acțiune
6. Actualizare `IrisQuickActions.tsx` și `IrisContextHints.tsx`
7. Deploy + test

