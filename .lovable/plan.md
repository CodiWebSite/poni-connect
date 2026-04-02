

# IRIS — Asistent AI Academic ICMPP

## Rezumat
Implementarea completă a asistentului AI **IRIS** (Inteligență pentru Resurse Interne și Suport) — un copilot intern academic, read-only în v1, integrat direct în platformă cu context real din baza de date, respectând strict rolurile și permisiunile existente.

## Fișiere Noi

### 1. `supabase/functions/iris-chat/index.ts`
Edge function principală:
- Validare JWT manuală + extragere user_id
- Query-uri contextuale pe baza rolului:
  - **Toți**: `profiles` (nume, dept, funcție), `employee_records` (sold concediu), `leave_requests` (cererile proprii), `notifications` (alerte), `announcements` (recente), `changelog_entries` (noutăți)
  - **HR/sef_srus/super_admin**: `hr_requests` (cereri pending), `employee_personal_data` (documente expirate global)
  - **super_admin**: `health_check_logs`, `audit_logs` (rezumat activitate)
- System prompt detaliat cu:
  - Identitate IRIS (ton academic, cald, profesionist, exclusiv română)
  - Regulile de business (read-only, nu inventa date, nu expune date fără drept, spune clar când nu știe)
  - Harta completă a rutelor platformei cu descriere pentru fiecare modul
  - Datele contextuale reale ale utilizatorului
  - Rolul utilizatorului + ce module are acces
- Primește `currentRoute` de la client pentru context pagină curentă
- Streaming via Lovable AI Gateway (`google/gemini-3-flash-preview`)
- CORS headers standard

### 2. `src/components/iris/IrisButton.tsx`
Buton flotant fixed bottom-right:
- Icon Sparkles cu gradient animat
- Pulsating badge la prima vizită (localStorage flag)
- Tooltip "IRIS — Asistent AI"
- Ascuns pe `/kiosk`, `/auth`, rute publice
- Vizibil doar pentru utilizatori autentificați
- z-index 40 (sub modals/dialogs)

### 3. `src/components/iris/IrisChatPanel.tsx`
Panel principal de chat:
- Desktop: panel 420px fixed bottom-right cu slide-up animation
- Mobil: full-screen drawer
- Header cu gradient brand + titlu IRIS + buton close
- Zona de mesaje cu auto-scroll
- Sugestii rapide (IrisQuickActions) afișate când conversația e goală
- Input cu Enter to send + buton send
- Streaming SSE token-by-token cu react-markdown rendering
- Indicator "IRIS scrie..." cu shimmer animation
- Trimite `currentRoute` (window.location.pathname) la fiecare mesaj
- Sesiune în memorie (useState), nu persistentă

### 4. `src/components/iris/IrisMessageBubble.tsx`
Componentă mesaj:
- User: bulă albastră/primară, aliniat dreapta
- IRIS: bulă gri/muted, aliniat stânga, cu avatar IRIS (Sparkles icon)
- Markdown rendering cu react-markdown (prose styling)
- Fade-in animation

### 5. `src/components/iris/IrisQuickActions.tsx`
Chip-uri de sugestii rapide, adaptate pe rol:
- **Toți**: "Câte zile de concediu am?", "Ce documente îmi expiră?", "Cum depun o cerere?", "Ce e nou în platformă?"
- **HR/staff**: + "Câte cereri sunt în așteptare?", "Rezumat activitate săptămânală"
- **super_admin**: + "Starea sistemului", "Cine s-a logat recent?"
- Click pe chip → trimite ca mesaj

### 6. `src/components/iris/IrisContextHints.tsx`
Hints contextuale bazate pe ruta curentă:
- Pe `/leave-request`: "Pot să te ajut cu cererea de concediu"
- Pe `/hr-management`: "Întreabă-mă despre angajați sau documente"
- Pe `/admin`: "Pot verifica starea sistemului"
- Afișate ca banner subtil în panelul de chat

## Fișiere Modificate

### 7. `src/App.tsx`
- Import `IrisButton`
- Render `<IrisButton />` în interiorul provider-ilor, condiționat de autentificare (verificat cu `useAuth`)
- Plasat lângă `ImpersonationBanner`, vizibil pe toate paginile (mai puțin kiosk/auth)

### 8. `supabase/config.toml`
- Adăugare `[functions.iris-chat]` cu `verify_jwt = false` (validare JWT în cod)

## Reguli de Securitate în Edge Function
- Toate query-urile filtrate pe `user_id` autentificat
- HR/admin query-uri condiționate de verificarea rolului prin `user_roles` table
- Nu se returnează CNP, CI, adresă, telefon — niciodată
- System prompt instrucționează explicit: "Nu inventa date", "Spune clar când nu ai informația", "Nu expune date ale altor utilizatori"
- Rolul `admin` nu este recunoscut — doar `super_admin` are acces total

## Dependințe
- `react-markdown` — trebuie instalat (rendering răspunsuri AI)

## Changelog
- Insert în `changelog_entries` cu versiunea corespunzătoare documentând lansarea IRIS

