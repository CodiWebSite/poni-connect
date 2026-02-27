

## Înlocuitor Temporar pentru Aprobarea Concediilor

Când un aprobator (șef de departament) pleacă în **concediu** sau în **delegație**, acesta trebuie să poată desemna un coleg din departament care să aprobe cererile de concediu în locul său, pe o perioadă definită.

### 1. Tabel nou: `leave_approval_delegates`

| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | uuid PK | |
| delegator_user_id | uuid NOT NULL | Aprobatorul care pleacă |
| delegate_user_id | uuid NOT NULL | Cine preia aprobarea |
| department | text | Departamentul |
| start_date | date NOT NULL | De când |
| end_date | date NOT NULL | Până când |
| reason | text | „concediu" sau „delegație" sau text liber |
| is_active | boolean DEFAULT true | Dezactivare manuală |
| created_at | timestamptz | |

RLS: aprobatorii pot gestiona propriile înlocuiri; HR poate vedea/gestiona toate; delegații pot vedea ce li se atribuie.

### 2. Componentă nouă: `LeaveApprovalDelegate.tsx`

- Vizibilă doar pentru aprobatori (șefi + aprobatori desemnați)
- Formular: selectează coleg din departament, perioadă, motiv (Concediu / Delegație / Altele)
- Lista înlocuirilor active, viitoare și expirate
- Buton de dezactivare manuală

### 3. Tab nou pe pagina Cereri Concediu

- Tab „Înlocuitor" vizibil doar pentru utilizatorii cu drept de aprobare (`canApprove`)
- Conține componenta `LeaveApprovalDelegate`

### 4. Logică extinsă în `LeaveApprovalPanel.tsx`

- La încărcarea cererilor, verifică dacă există delegări active (data curentă între start_date și end_date, is_active = true) unde utilizatorul curent este `delegate_user_id`
- Dacă da, afișează și cererile destinate aprobatorului absent

### 5. Notificări la trimiterea cererii (`LeaveRequestForm.tsx`)

- Când se trimite o cerere și aprobatorul are o înlocuire activă, notificarea se trimite **și** înlocuitorului

### Fișiere de creat/modificat

1. **Migrare SQL** — tabel `leave_approval_delegates` + politici RLS
2. **`src/components/leave/LeaveApprovalDelegate.tsx`** — componentă nouă
3. **`src/pages/LeaveRequest.tsx`** — tab „Înlocuitor" pentru aprobatori
4. **`src/components/leave/LeaveApprovalPanel.tsx`** — filtrare extinsă cu delegări active
5. **`src/components/leave/LeaveRequestForm.tsx`** — notificare înlocuitor

