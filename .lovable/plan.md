

## Plan: Mod Demo pentru Platforma ICMPP

### Concept

Un **Mod Demo** activabil din sidebar care permite utilizatorilor sa exerseze toate fluxurile platformei (cereri concediu, etc.) fara ca actiunile sa afecteze datele reale. Datele demo se salveaza separat si se sterg periodic.

### Arhitectura

```text
┌─────────────────────────────────────────┐
│           DemoModeContext               │
│  ┌─────────┐  ┌──────────────────────┐  │
│  │ isDemo  │  │ toggleDemo()         │  │
│  │ boolean │  │ activare/dezactivare │  │
│  └─────────┘  └──────────────────────┘  │
└─────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐    ┌──────────────────┐
│  Sidebar toggle  │    │  Banner global   │
│  (buton Demo)    │    │  "MOD DEMO ACTIV"│
└──────────────────┘    └──────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Formulare (LeaveRequestForm, etc.)      │
│  if (isDemo) → insert cu is_demo=true   │
│  Liste → filtrare dupa is_demo          │
└──────────────────────────────────────────┘
```

### Implementare pas cu pas

**1. Migratie baza de date**
- Adaug coloana `is_demo BOOLEAN DEFAULT false` pe tabela `leave_requests` (si pe alte tabele viitoare daca se extinde)
- Aceasta coloana separa datele reale de cele demo

**2. Context React: `DemoModeContext`**
- Noul fisier `src/contexts/DemoModeContext.tsx`
- State `isDemo` persistat in `localStorage` (se pastreaza la refresh)
- Functie `toggleDemo()` si valoarea `isDemo` expuse prin hook `useDemoMode()`

**3. Toggle in Sidebar**
- Buton nou in footer-ul sidebar-ului (langa "Deconectare")
- Icon `FlaskConical` + label "Mod Demo" cu un Switch
- Cand sidebar e collapsed, tooltip cu starea

**4. Banner global in Header**
- Cand `isDemo` e activ, se afiseaza un banner portocaliu/galben fix sub header: "MOD DEMO ACTIV — Actiunile nu afecteaza datele reale"
- Buton rapid "Dezactiveaza" in banner

**5. Modificari LeaveRequestForm**
- La submit, daca `isDemo === true`, se seteaza `is_demo: true` in obiectul inserat in `leave_requests`
- Toast de succes cu mentiunea "[DEMO]"
- Se genereaza automat o aprobare fictiva dupa 2 secunde (simulare flux)

**6. Modificari liste si query-uri**
- `LeaveRequestsList` → filtreaza `.eq('is_demo', isDemo)` — in mod normal vede doar cererile reale, in mod demo vede doar pe cele demo
- `LeaveApprovalPanel` → la fel, afiseaza doar cereri demo cand e in demo mode
- `LeaveCalendar` → exclude `is_demo = true` din vizualizare

**7. Curatare automata date demo**
- Se adauga o functie backend (Edge Function sau cron) care sterge periodic (zilnic) randurile cu `is_demo = true` mai vechi de 24h
- Alternativ, un buton "Sterge datele demo" in interfata

**8. Indicatori vizuali suplimentari**
- In listele de cereri, randurile demo au un badge "[DEMO]" si fundal diferit
- Pe formularele din mod demo, un mic banner informativ: "Aceasta cerere este de exercitiu"

### Fisiere afectate

| Fisier | Modificare |
|--------|-----------|
| `src/contexts/DemoModeContext.tsx` | **NOU** — context + provider + hook |
| `src/App.tsx` | Wrap cu `DemoModeProvider` |
| `src/components/layout/Sidebar.tsx` | Toggle Mod Demo in footer |
| `src/components/layout/Header.tsx` | Banner "MOD DEMO ACTIV" |
| `src/components/leave/LeaveRequestForm.tsx` | Insert cu `is_demo` flag |
| `src/components/leave/LeaveRequestsList.tsx` | Filtrare dupa `is_demo` |
| `src/components/leave/LeaveApprovalPanel.tsx` | Filtrare dupa `is_demo` |
| `src/components/leave/LeaveApprovalHistory.tsx` | Filtrare dupa `is_demo` |
| `src/components/leave/LeaveRequestsHR.tsx` | Filtrare dupa `is_demo` |
| Migratie SQL | Coloana `is_demo` pe `leave_requests` |

