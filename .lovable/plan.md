

# Plan: Reconciliere solduri concediu post-restaurare

## Problema
Backup-ul din 1 aprilie a restaurat `employee_records`, `employee_personal_data` și `leave_carryover` la starea din acea dată. Cererile aprobate între 1-6 aprilie nu au fost scăzute din solduri. Actualmente `used_leave_days = 0` pentru angajații cu cereri aprobate post-backup.

## Ce am găsit

**Cereri digitale aprobate post-backup** (`leave_requests`, `created_at > 2026-04-01T13:05`):
- **24 de angajați** cu total **~120 zile** de scăzut
- Exemple: AVĂDĂNEI (9z), GAINA (4z), BUTNARU (4z)

**Cereri manuale aprobate post-backup** (`hr_requests`, tip CO):
- **7 intrări** cu split explicit `daysFromCarryover` / `daysFromCurrent`
- Total: 14 zile din report + 11 zile din sold curent

**Cereri pre-backup cu start după 1 aprilie** (`leave_requests`, `created_at ≤ backup`):
- **~30 de angajați** — deja contabilizate în backup, **NU trebuie scăzute din nou**

## Abordare

Voi recalcula complet soldurile 2026 pentru TOȚI angajații pe baza tuturor cererilor aprobate (CO) din 2026, folosind logica FIFO (raport apoi sold curent):

### Pas 1 — Calculez totalul zilelor aprobate per angajat
- Din `leave_requests` (status = 'approved', year = 2026)
- Din `hr_requests` (tip CO, status = 'approved', anul 2026) — doar cele cu `daysFromCurrent > 0` sau `daysFromCarryover > 0`

### Pas 2 — Simulare FIFO per angajat
- Scad mai întâi din `leave_carryover.remaining_days` (report an anterior)
- Restul se scade din soldul curent (`employee_records.used_leave_days` + `employee_personal_data.used_leave_days`)

### Pas 3 — Actualizare baza de date
- `UPDATE employee_records SET used_leave_days = X` (doar zilele din soldul curent 2026)
- `UPDATE employee_personal_data SET used_leave_days = X` (idem)
- `UPDATE leave_carryover SET used_days = Y, remaining_days = initial_days - Y` (zilele din report)

### Pas 4 — Verificare
- Compar soldurile finale cu cererile aprobate
- Afișez un tabel rezumat pentru validare

## Detalii tehnice
- Scriptul va rula ca UPDATE-uri SQL prin insert tool (nu migrație)
- Se procesează batch (50 angajați/batch) pentru a evita timeout
- Cererile de tip CM, D, EV, L, M nu se scad din sold (doar CO)
- Se păstrează `total_leave_days` neschimbat

