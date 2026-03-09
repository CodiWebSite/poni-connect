

## Mod Kiosk / TV — Plan de implementare

Da, se poate face și este destul de simplu. Ideea: o pagină publică dedicată (fără login, fără sidebar, fullscreen) care afișează în buclă informații utile pe un TV din hol.

### Ce se construiește

**O pagină nouă `/kiosk`** — rută publică, fără autentificare, fără layout standard. Conține:

1. **Header**: logo ICMPP + ceas live + data curentă
2. **Anunțuri pinned** — preluate din tabela `announcements` (cele pinned + urgente), auto-refresh la 60s
3. **Meteo Iași** — reutilizăm logica din `WeatherWidget`, afișaj mare
4. **Status mentenanță** — dacă `maintenance_mode` e activ, banner vizibil
5. **Ora / program** — ceas digital mare, eventual „Program: L-V 08:00–16:00"

**Auto-rotate**: conținutul se rotește automat între secțiuni (carousel) sau totul e afișat simultan pe un layout split-screen optimizat pentru TV (16:9).

### Detalii tehnice

| Element | Detalii |
|---------|---------|
| Ruta | `/kiosk` în `App.tsx`, exclusă din `MaintenanceGuard` (ca `/auth`) |
| Auth | Fără — datele afișate sunt publice (anunțuri, meteo, status) |
| RLS | Politică `SELECT` pentru `anon` pe `announcements` (doar `is_pinned = true` sau `priority = 'urgent'`) |
| Refresh | Polling la fiecare 60 secunde pentru anunțuri + realtime pe `app_settings` |
| Layout | Fullscreen, fără scroll, font-uri mari, dark mode implicit |
| Anti-sleep | `wakeLock` API + meta refresh fallback pentru a preveni oprirea ecranului |

### Structura paginii (layout TV)

```text
┌─────────────────────────────────────────────────┐
│  🏛 ICMPP Iași          Luni, 10 Mar    14:32   │
├───────────────────────────┬─────────────────────┤
│                           │   ☀ 18°C            │
│   ANUNȚURI                │   Parțial noros      │
│   (carousel auto-scroll)  │   Umiditate: 65%    │
│                           ├─────────────────────┤
│                           │   📅 EVENIMENTE     │
│                           │   (dacă există)     │
│                           ├─────────────────────┤
│                           │   ⚠ MENTENANȚĂ      │
│                           │   (dacă e activ)    │
├───────────────────────────┴─────────────────────┤
│  Program: L-V 08:00 – 16:00 │ intranet.icmpp.ro │
└─────────────────────────────────────────────────┘
```

### Fișiere noi/modificate

- **Nou**: `src/pages/Kiosk.tsx` — pagina completă, standalone
- **Modificat**: `src/App.tsx` — adăugare rută `/kiosk`, exclusă din MaintenanceGuard
- **Migrație SQL**: politică RLS `anon SELECT` pe `announcements` (filtrată pe pinned/urgent)
- **Opțional**: toggle în Admin → Settings pentru activare/dezactivare mod Kiosk

### Utilizare

Deschizi pe TV-ul din hol: `https://intranet.icmpp.ro/kiosk` — fără login, fullscreen (F11), rulează non-stop.

