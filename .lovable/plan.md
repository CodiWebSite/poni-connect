
# IRIS — Asistent AI pentru Platforma ICMPP

## Ce este IRIS

IRIS (Inteligență pentru Resurse Interne și Suport) este un chatbot AI integrat în platformă, accesibil printr-un buton flotant pe toate paginile. Folosește Lovable AI (deja disponibil — LOVABLE_API_KEY configurat) pentru a răspunde la întrebări despre platforma, datele utilizatorului și procedurile institutului.

## Arhitectura

```text
src/components/iris/
  ├── IrisButton.tsx          ← Buton flotant (colț dreapta-jos)
  ├── IrisChatPanel.tsx       ← Panoul de chat (slide-up / drawer pe mobil)
  └── IrisMessageBubble.tsx   ← Bule de mesaj cu markdown rendering

supabase/functions/iris-chat/index.ts  ← Edge function care:
  1. Primește mesajul + context utilizator
  2. Query-uri automate pe tabelele platformei (rol, concediu, documente, cereri)
  3. Construiește system prompt cu context real
  4. Streamează răspunsul via Lovable AI Gateway
```

## Funcționalități IRIS

### 1. Navigare și căutare inteligentă
IRIS știe structura platformei și poate răspunde la:
- „Câte zile de concediu mai am?" → query `employee_records` pt user curent
- „Unde depun o cerere de concediu?" → link direct `/leave-request`
- „Ce documente îmi expiră?" → query `employee_documents` + `employee_personal_data.ci_expiry_date`
- „Cine e în concediu azi?" → query `leave_requests` active azi
- „Ce anunțuri noi sunt?" → query `announcements` recente

### 2. Asistent HR și documente
- Explică tipurile de concediu disponibile (CO, medical, etc.)
- Ghidează prin procesul de completare a cererilor
- Verifică ce documente lipsesc din dosarul digital
- Explică fluxul de aprobare (cine aprobă, ce etape)

### 3. Rezumate și rapoarte
- „Ce s-a întâmplat săptămâna asta?" → rezumat anunțuri + cereri
- „Care sunt alertele mele?" → notificări recente
- „Ce e nou în platformă?" → changelog entries recente

### 4. Ghid platformă interactiv
- Explică funcționalitățile platformei
- Oferă link-uri directe către secțiuni relevante
- Adaptează răspunsurile în funcție de rol (HR vede altceva decât angajat)

## Implementare Detaliată

### Edge Function: `supabase/functions/iris-chat/index.ts`
- Primește: `{ messages, context_type? }` + auth token
- Extrage user_id din JWT
- Face query-uri contextuale pe baza întrebării:
  - Dacă întreabă de concediu → query `employee_records` pentru sold
  - Dacă întreabă de documente → query `employee_documents` + expirări
  - Dacă întreabă de cereri → query `hr_requests` pentru status
  - Dacă întreabă de echipă → query profiles din departament
  - Dacă întreabă de anunțuri → query `announcements` recente
- Construiește system prompt cu:
  - Rolul utilizatorului
  - Numele complet
  - Departamentul
  - Datele contextuale extrase
  - Maparea rutelor platformei
- Streamează răspunsul via Lovable AI Gateway (google/gemini-3-flash-preview)
- Răspunde DOAR în limba română

### Frontend: Buton Flotant + Panel
- Buton rotund cu icon IRIS (Sparkles/Brain) în colțul dreapta-jos
- Click → deschide panel de chat (400px lățime pe desktop, full-screen pe mobil)
- Streaming token-by-token cu markdown rendering (react-markdown)
- Istoricul conversației se păstrează în session (useState), NU persistent
- Sugestii rapide la deschidere: „Câte zile de concediu am?", „Ce documente îmi expiră?", „Ghid platformă"
- Badge animat pulsating pentru prima deschidere

### Integrare în App
- `IrisButton` adăugat direct în `App.tsx`, vizibil pe toate paginile (doar pt utilizatori autentificați)
- Nu blochează navigarea, nu interferează cu alte elemente

## Securitate
- Edge function validează JWT-ul utilizatorului
- Query-urile sunt filtrate pe user_id-ul autentificat
- Nu se expune informații sensibile ale altor utilizatori
- Rolurile avansate (HR, super_admin) primesc context extins

## Design
- Panel elegant cu gradient header (brand ICMPP)
- Bule de mesaj clare: utilizator dreapta, IRIS stânga
- Sugestii ca chip-uri clicabile
- Animație smooth la deschidere/închidere
- Dark mode suportat
- Responsive complet

## Pași de Implementare
1. Creează edge function `iris-chat` cu system prompt, context queries și streaming
2. Creează componentele UI (IrisButton, IrisChatPanel, IrisMessageBubble)  
3. Integrează IrisButton în App.tsx (vizibil doar pt utilizatori autentificați)
4. Adaugă în changelog
