

# Plan: Modul „Test de Siguranță Digitală"

## Rezumat
Crearea unui modul complet de evaluare a cunoștințelor de securitate digitală pentru angajații ICMPP, cu test interactiv bazat pe scenarii, panou de administrare și statistici.

---

## 1. Baza de date (3 tabele noi)

### `security_quiz_questions`
- `id`, `category` (enum: phishing, phone_fraud, bank_data, remote_access, fake_investments), `question_type` (single_choice, multiple_choice, true_false, scenario), `question_text`, `options` (jsonb array), `correct_answers` (jsonb array of indices), `explanation` (text), `difficulty` (easy/medium/hard), `is_active` (boolean, default true), `order_index`, `created_by`, `created_at`, `updated_at`

### `security_quiz_attempts`
- `id`, `user_id`, `score` (integer), `total_questions` (integer), `answers` (jsonb — array of {question_id, selected, correct}), `risk_level` (text), `completed_at`, `created_at`

### `security_quiz_question_stats`
- Alternatively, stats can be computed via aggregate queries on `attempts.answers` — no separate table needed.

### RLS Policies
- Questions: all authenticated can SELECT active questions; super_admin can ALL
- Attempts: users can INSERT/SELECT own; super_admin/hr can SELECT all
- Enable RLS on both tables

---

## 2. Pagină nouă: `/securitate-digitala`

**Route** adăugat în `App.tsx`, link adăugat în `Sidebar.tsx` (secțiune generală, icon `ShieldCheck`).

### Componente principale:

**`SecurityQuizPage.tsx`** — pagina principală cu 3 stări:
1. **Landing** — card de bun venit, descriere scurtă, buton „Începe Testul", istoric încercări anterioare, data ultimei completări
2. **Quiz activ** — progres bar, carduri cu întrebări, navigare înainte/înapoi
3. **Rezultate** — scor, nivel de risc, recapitulare per întrebare cu explicații

**`SecurityQuizLanding.tsx`** — ecranul de start cu:
- Descriere modulului
- Ultimul scor și data
- Istoric încercări (tabel simplu)
- Buton „Începe Testul"

**`SecurityQuizEngine.tsx`** — motorul testului:
- Încarcă întrebările active, le randomizează
- Progress bar vizibil
- Render diferit per tip (single, multiple, true/false, scenario)
- Validare la submit

**`SecurityQuizResults.tsx`** — pagina de rezultate:
- Scor procentual + categorie (Foarte bine ≥90%, Bine 70-89%, Risc moderat 50-69%, Risc ridicat <50%)
- Lista întrebărilor cu răspunsurile date vs corecte + explicații
- 5 reguli esențiale de siguranță digitală
- Recomandări personalizate bazate pe categoriile greșite
- Buton „Refă testul"

**Componente de întrebare:**
- `QuizQuestionCard.tsx` — card unificat cu render condiționat per tip
- Design modern cu carduri curate, culori verzi/roșii/portocalii pentru feedback

---

## 3. Panou de administrare

Adaug un tab nou „Securitate Digitală" în pagina `/admin` (Admin.tsx), vizibil doar pentru super_admin.

**`SecurityQuizAdminPanel.tsx`**:
- Tabel cu toate întrebările (filtru pe categorie, status activ/inactiv)
- Dialog de adăugare/editare întrebare
- Toggle activ/dezactiv
- Statistici agregate: rata medie de răspuns corect per întrebare, nr. total completări, scor mediu
- Filtrare statistici pe departament (via join cu employee_personal_data)

---

## 4. Conținut pre-populat

Inserare directă în DB a ~15 întrebări inițiale, organizate pe cele 5 categorii, inspirate din PDF-ul furnizat:
- 3 scenarii practice (phishing SMS, apel fals bancă, investiție frauduloasă)
- 5 întrebări single choice
- 4 adevărat/fals
- 3 identificare element suspect

---

## 5. Fișiere create/modificate

| Acțiune | Fișier |
|---------|--------|
| Creat | `src/pages/SecurityQuiz.tsx` |
| Creat | `src/components/security-quiz/SecurityQuizLanding.tsx` |
| Creat | `src/components/security-quiz/SecurityQuizEngine.tsx` |
| Creat | `src/components/security-quiz/SecurityQuizResults.tsx` |
| Creat | `src/components/security-quiz/QuizQuestionCard.tsx` |
| Creat | `src/components/admin/SecurityQuizAdminPanel.tsx` |
| Modificat | `src/App.tsx` — rută nouă |
| Modificat | `src/components/layout/Sidebar.tsx` — link nou |
| Modificat | `src/pages/Admin.tsx` — tab nou |
| Migrare DB | 2 tabele + RLS policies |
| Insert DB | ~15 întrebări pre-populate |

---

## Detalii tehnice

- Întrebările sunt stocate în DB, nu hardcodate — adminul poate adăuga/edita oricând
- Răspunsurile sunt salvate ca JSONB pentru flexibilitate
- Scorul se calculează client-side și se salvează la completare
- Design consistent cu restul platformei (glassmorphism, carduri, Tailwind)
- Responsive — funcționează pe desktop și mobil
- Tonul este calm, educativ, prietenos — nu panicard

