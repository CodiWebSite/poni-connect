
# Plan: Modul „Idei & Feedback"

## 1. Baza de date (3 tabele noi + migrare)

### `suggestions`
- `id`, `user_id` (nullable pt anonim), `title`, `description`, `category`, `type` (idea/feedback/problem/improvement), `priority` (low/medium/high), `target_module`, `is_anonymous`, `status` (new/in_review/approved/in_progress/implemented/rejected), `admin_response`, `admin_responded_by`, `admin_responded_at`, `vote_count` (default 0), `comment_count` (default 0), `created_at`, `updated_at`

### `suggestion_votes`
- `id`, `suggestion_id`, `user_id`, `created_at`
- Unique constraint pe (suggestion_id, user_id)

### `suggestion_comments`
- `id`, `suggestion_id`, `user_id`, `content`, `is_admin_reply`, `created_at`

### RLS
- Suggestions: authenticated can SELECT (non-anonymous see all; anonymous hide user_id), INSERT own; super_admin can UPDATE all
- Votes: authenticated can INSERT/DELETE own, SELECT all
- Comments: authenticated can SELECT/INSERT; super_admin can DELETE

---

## 2. Pagină: `/sugestii` (Suggestions.tsx)

### Componente:

**Tab 1 — Feed de idei**
- Carduri cu titlu, categorie, status badge colorat, autor/Anonim, dată, voturi, comentarii
- Filtre: categorie, status, tip, sortare (cele mai noi, cele mai votate)
- Căutare text
- Buton „Susțin" pe fiecare card
- Expand card → comentarii + răspuns admin

**Tab 2 — Trimite o idee**
- Formular: titlu, descriere (textarea), categorie (select), tip (select), prioritate (select), modul vizat (optional), toggle nominal/anonim
- Confirmare toast după trimitere

**Tab 3 — Ideile mele**
- Lista ideilor proprii cu status vizibil
- Vizibil doar pentru user autentificat

---

## 3. Panou admin (tab nou în Admin.tsx)

**`SuggestionsAdminPanel.tsx`**
- Tabel cu toate ideile, filtre pe categorie/status/dată
- Schimbare status via dropdown
- Adăugare răspuns oficial
- Statistici: total, noi, în analiză, implementate, cele mai votate, categorii active, timp mediu răspuns

---

## 4. Fișiere create/modificate

| Acțiune | Fișier |
|---------|--------|
| Creat | `src/pages/Suggestions.tsx` |
| Modificat | `src/App.tsx` — rută `/sugestii` |
| Modificat | `src/components/layout/Sidebar.tsx` — link nou |
| Modificat | `src/pages/Admin.tsx` — tab admin |
| Migrare DB | 3 tabele + RLS + realtime |

---

## 5. Design
- Carduri glassmorphism cu badge-uri colorate per status
- Status: Nouă (blue), În analiză (amber), Aprobată (emerald), În lucru (purple), Implementată (green), Respinsă (red)
- Buton „Susțin" cu animație și counter
- Feed sortabil și filtrabil
- Formular curat cu toggle anonim elegant
