

# Plan: Reparare completă solduri concedii — 145 angajați afectați, 554 zile eronate

## Problema identificată

Am investigat baza de date și am găsit **145 angajați activi** cu solduri de concediu eronate, totalizând **554 zile diferență**.

### Cauza principală
Sistemul are **două surse de concediu** care nu sunt sincronizate corect:
1. **Cereri digitale** (`leave_requests`) — depuse de angajați prin platformă
2. **Înregistrări manuale HR** (`hr_requests` tip `concediu`) — adăugate de HR

Problema: când SRUS aprobă o cerere digitală, funcția `deductLeaveDays()` deduce zilele din report (carryover) prin FIFO, dar **nu actualizează `used_leave_days`** pentru porțiunea dedusă din report. De asemenea, pentru ~43 de angajați cu cereri aprobate, deducerea nu a rulat deloc (`epd.used_leave_days = 0`).

### Exemple concrete
- **ADRIAN BELE**: 5 zile aprobate digital, `used_leave_days = 0` (deducerea nu a rulat)
- **ANCA ROXANA PETROVICI**: 8 zile aprobate, `used_leave_days = 0`
- **ANDRA-ELENA BEJAN**: 7 zile aprobate, `used_leave_days = 13` (supraestimat)
- **BUTNARU IRINA**: 5 zile digitale + 2 manuale = 7 total, dar `used_leave_days = 3`

---

## Plan de implementare

### Pasul 1 — Script de recalculare solduri (migration SQL)

Voi crea un script care, pentru **fiecare angajat activ**:

1. Calculează total zile CO deductibile din ambele surse:
   - `leave_requests` (status: approved/pending) → `working_days`
   - `hr_requests` (tip concediu, leaveType = 'co', approved) → `numberOfDays`

2. Aplică FIFO:
   - Mai întâi deduce din `leave_carryover.remaining_days` (report 2025→2026)
   - Restul merge în `employee_personal_data.used_leave_days`

3. Actualizează sincronizat:
   - `leave_carryover.used_days` și `remaining_days`
   - `employee_personal_data.used_leave_days`
   - `employee_records.used_leave_days` (via trigger existent)

### Pasul 2 — Fix logica de deducere la aprobare SRUS

În `LeaveApprovalPanel.tsx`, funcția `deductLeaveDays()`:
- Problema actuală: actualizează `epd.used_leave_days` doar cu zilele rămase DUPĂ carryover
- Fix: trebuie să recalculeze soldul complet sau cel puțin să garanteze că totalul dedus (carryover + curent) este consistent

### Pasul 3 — Fix logica la înregistrare manuală HR

În `EmployeeLeaveHistory.tsx`:
- Verificare că deducerea din carryover + curent funcționează corect
- Adăugare recalculare totală la salvare (nu increment, ci recalculare)

### Pasul 4 — Adăugare funcție de recalculare automată

Creez o funcție DB `recalculate_leave_balance(epd_id)` care:
- Poate fi apelată oricând pentru a corecta soldul unui angajat
- Ia în calcul ambele surse de concediu
- Aplică FIFO corect
- Poate fi apelată din UI de HR pentru „Recalculare sold"

### Pasul 5 — Buton „Recalculare solduri" în HR Dashboard

Adaug un buton în modulul HR care permite recalcularea în masă a soldurilor, pentru situații similare în viitor.

---

## Fișiere modificate

| Fișier | Modificare |
|--------|-----------|
| Migration SQL nouă | Script recalculare toate soldurile |
| `src/components/leave/LeaveApprovalPanel.tsx` | Fix `deductLeaveDays()` — recalculare completă |
| `src/components/hr/EmployeeLeaveHistory.tsx` | Fix deducere la înregistrare manuală |
| `src/components/hr/HRDashboard.tsx` | Buton recalculare solduri |
| `src/components/dashboard/PersonalLeaveWidget.tsx` | Include carryover în afișare |

---

## Prioritate și ordine

1. **Critic** — Migration recalculare (corectează imediat cele 145 cazuri)
2. **Critic** — Fix `deductLeaveDays()` (previne probleme viitoare)
3. **Important** — Funcție `recalculate_leave_balance` + buton HR
4. **Nice-to-have** — Widget personal actualizat cu carryover

