

## Plan: Sistem de aprobare ierarhică pe departament cu mapare directă aprobator

### Problema
Rolurile actuale (`sef`, `sef_srus`) sunt generice — nu definesc cine aprobă pe cine. Un șef de laborator nu-și poate aproba singur concediul; trebuie să-i fie desemnat un aprobator specific (ex: șeful de compartiment).

### Soluție: Tabel `leave_approvers`

Un tabel simplu care mapează fiecare angajat la aprobatorul său direct pentru concedii. HR/Super Admin configurează aceste relații.

```text
┌─────────────────────────────────────────────┐
│  leave_approvers                            │
├─────────────────────────────────────────────┤
│  id              uuid PK                    │
│  employee_user_id uuid UNIQUE → profiles    │
│  approver_user_id uuid → profiles           │
│  created_by       uuid                      │
│  created_at       timestamptz               │
│  notes            text (opțional)           │
└─────────────────────────────────────────────┘

Exemplu:
  Angajat Ion (user)      → Aprobator: Șef Lab Popescu
  Șef Lab Popescu (sef)   → Aprobator: Șef Compartiment Ionescu  
  Șef Compartiment Ionescu → Aprobator: Director (auto-aprobare existentă)
```

### Flux la depunere cerere

1. La submit, se caută `leave_approvers` pentru `user_id` curent
2. Dacă există aprobator definit → cererea merge la acel aprobator specific
3. Dacă NU există → fallback la comportamentul actual (orice `sef`/`sef_srus` din departament)
4. Directorul rămâne auto-aprobat (fără schimbări)

### Flux la aprobare

Tab-ul "De Aprobat" afișează cererile unde utilizatorul curent este aprobatorul desemnat (din `leave_approvers`) SAU unde e șef generic și cererea nu are aprobator specific.

### Modificări

**Migrare SQL:**
- Creare tabel `leave_approvers` cu RLS (HR + super_admin pot gestiona)
- Coloană nouă `approver_id` pe `leave_requests` pentru a stoca aprobatorul desemnat

**Fișiere modificate:**
- `src/pages/HRManagement.tsx` — Tab nou "Aprobatori" cu interfață de configurare: selectează angajat → selectează aprobator din lista de profili
- `src/components/leave/LeaveRequestForm.tsx` — La submit, lookup în `leave_approvers` și setează `approver_id`
- `src/components/leave/LeaveApprovalPanel.tsx` — Filtrare cereri: afișează unde `approver_id = auth.uid()` SAU (fără approver_id + fallback departament)
- `src/pages/LeaveRequest.tsx` — Tab "De Aprobat" vizibil și pentru utilizatori care au subordonați în `leave_approvers` (nu doar roluri `sef`)
- `supabase/functions/notify-leave-email/index.ts` — Trimite email la aprobatorul specific dacă există, altfel fallback la șefii departamentului

**Changelog:**
- Actualizare v2.7 în tab-ul Modificări

### Avantaje
- Flexibil: orice ierarhie, orice departament
- Nu necesită roluri noi per departament
- HR configurează ușor cine aprobă pe cine
- Backward-compatible: dacă nu e configurat, funcționează ca înainte

