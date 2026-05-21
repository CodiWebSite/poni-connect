## Diagnostic

Cererea Luminitei Marin ajunge la Marcela Mihai pentru că `leave_requests.approver_id` se setează corect din `leave_approvers` (mapare individuală). Panoul de aprobare însă afișează `N/A` pentru că:

1. **RLS pe `employee_personal_data` este incompletă.** Politica `Leave approvers can view EPD of approved departments` folosește `is_leave_approver_for_epd(auth.uid(), id)`, iar funcția verifică **doar** `leave_department_approvers`:

   ```sql
   SELECT EXISTS (
     SELECT 1 FROM employee_personal_data epd
     JOIN leave_department_approvers lda ON lda.department = epd.department
     WHERE epd.id = _epd_id AND lda.approver_user_id = _user_id
   );
   ```

   Pentru aprobatorii desemnați individual via `leave_approvers` și pentru delegații activi, această verificare returnează `false` → RLS blochează rândul EPD → `epdMap` rămâne gol → `N/A`. Pentru o aprobare cross-departament (Marcela aprobă pe cineva din alt departament) același bug apare.

2. **Fallback de afișare lipsește.** `LeaveApprovalPanel.tsx` se bazează exclusiv pe `epd_id → employee_personal_data`. Dacă EPD lipsește sau este invizibil, nu încearcă `profiles.full_name` via `leave_requests.user_id`, deși tabela `profiles` are RLS permisiv pentru utilizatorii autentificați.

## Soluție

### 1. Extinde funcția `is_leave_approver_for_epd` (migration SQL)

Aliniaz-o cu logica `is_leave_approver_for_request` pentru a acoperi toate căile de aprobare:

- aprobator desemnat individual în `leave_approvers` (link `employee_user_id` → `employee_records.user_id` → `epd.employee_record_id`)
- aprobator pe departament în `leave_department_approvers` (păstrat)
- delegat activ al unui aprobator individual (`leave_approval_delegates` cu `is_active=true` și `CURRENT_DATE BETWEEN start_date AND end_date`)
- delegat activ al unui aprobator pe departament

Funcția rămâne `SECURITY DEFINER STABLE`, fără recursivitate (nu interoghează `employee_personal_data` pentru decizia RLS pe `employee_personal_data` — folosește doar `leave_approvers`, `leave_department_approvers`, `employee_records`, `leave_approval_delegates`, plus join-ul `epd.id`/`epd.department` deja permis în interiorul SECURITY DEFINER).

Politica RLS existentă rămâne neschimbată (continuă să cheme funcția); doar corpul funcției crește. Nicio dată existentă nu e ștearsă.

### 2. Fallback robust în `LeaveApprovalPanel.tsx`

- După `epdMap`, construiește în paralel un `profileMap` din `profiles` folosind `leave_requests.user_id` (lista de `user_id` din cererile încărcate).
- La compunerea rândului: `employee_name = epdMap[epd_id]?.name || profileMap[user_id]?.full_name (reformatat NUME PRENUME via formatNumePrenume) || 'N/A'`.
- Departament / poziție: dacă lipsesc din EPD, încearcă `profiles.department` / `profiles.position`.
- Avatar: dacă EPD nu e vizibil, folosește direct `profiles.avatar_url` din `profileMap`.
- Păstrează logul existent în `audit_logs` când totuși ajungem la `N/A` (semnal pentru cazuri reziduale).

### 3. Aceeași tratare pentru ecranele înrudite

Aplică același pattern (EPD primar + fallback profiles) acolo unde apare deja `N/A` din același motiv pentru aprobatori:

- `src/components/leave/LeaveApprovalHistory.tsx`
- `src/components/leave/LeaveRequestsHR.tsx` (HR are deja acces, dar fallback-ul nu strică)
- orice altă listă care folosește `epdMap[r.epd_id]?.name || 'N/A'` cu rezultate vizibile aprobatorilor

(Voi face un `rg` în implementare și voi corecta doar fișierele care au exact același pattern.)

### Ce NU schimb

- Nu reset, nu drop, nu DELETE pe date.
- Nu modific proiectul Supabase / Lovable Cloud.
- Nu adaug câmpuri PII suplimentare în query-uri (doar `full_name`, `department`, `position`, `avatar_url` — deja folosite în UI).
- Nu schimb fluxul de rutare al cererilor și nici logica de aprobare/aprobare-delegată.

## Verificare după implementare

1. SQL: `SELECT is_leave_approver_for_epd('<marcela_user_id>', '<luminita_epd_id>')` → `true`.
2. UI: login ca aprobator individual / delegat → cererile arată numele corect; aprobarea funcționează.
3. Cazurile existente (șef departament, HR, SRUS) rămân neafectate.
4. Verific `audit_logs` pentru noi intrări `leave_approval_name_fallback` → ar trebui să dispară pentru cazurile reproduse.