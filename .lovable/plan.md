

# Plan: Refacere completă modul HR — Centru Profesionist de Administrare ICMPP

## Rezumat

Transformarea fișierului monolitic `HRManagement.tsx` (2785 linii, 10 tab-uri) într-o arhitectură modulară cu 7 secțiuni principale, fiecare în propriul fișier. Eliminarea dependenței de rolul `admin` din întregul proiect.

## Structura nouă de fișiere

```text
src/pages/HRManagement.tsx                    (refăcut — shell cu 7 tab-uri)
src/components/hr/
  ├── HRDashboard.tsx                         (NOU — KPI-uri + alerte + activitate)
  ├── EmployeeHub.tsx                         (NOU — listă + dosar angajat cu sub-taburi)
  ├── EmployeeFileDialog.tsx                  (NOU — dialog dosar individual cu 6 taburi)
  ├── EmployeeLifecycle.tsx                   (NOU — onboarding/arhivare/reactivare)
  ├── DataQualityPanel.tsx                    (NOU — audit calitate date)
  ├── DocumentsExpirationsPanel.tsx           (NOU — documente + expirări + remindere)
  ├── HRRequestsInbox.tsx                     (NOU — inbox cereri HR unificat)
  ├── HRNotificationsRules.tsx                (NOU — reguli notificări HR)
  ├── ... (componentele existente rămân neschimbate)
```

## Secțiunile detaliate

### 1. HR Dashboard (HRDashboard.tsx)

**KPI Cards** (grid responsive 2x3 → 3x2):
- Total angajați activi (query `employee_personal_data` WHERE `is_archived = false`)
- Angajați noi (luna curentă, filtru pe `employment_date`)
- Angajați arhivați (count `is_archived = true`)
- Angajați fără cont (`employee_record_id IS NULL`)
- Angajați fără rol (profiles fără intrare în `user_roles`)
- Documente lipsă / expirate (din `employee_documents` + `employee_personal_data.ci_expiry_date`)

**Alerte prioritare** (carduri colorate):
- Cereri de corecție date în așteptare (din `data_correction_requests` WHERE `status = 'pending'`)
- Cereri HR în așteptare (din `hr_requests` WHERE `status = 'pending'`)
- Documente care expiră în 30/60/90 zile
- Fișe medicale expirate

**Activitate recentă HR** — timeline cu ultimele 15 `audit_logs` WHERE `entity_type IN ('employee_personal_data', 'employee_records', 'hr_request', ...)`

### 2. Employee Hub (EmployeeHub.tsx + EmployeeFileDialog.tsx)

**Lista angajaților** — preia logica existentă din HRManagement.tsx:
- Toolbar: search, filtru departament, filtru cont, filtru status
- Tabel profesional cu coloane: Avatar+Nume, Email, Departament, Funcție/Grad, Contract, Status cont, Rol platformă, Acțiuni
- Sortare pe coloane, leadership badges

**Dosar Angajat** (EmployeeFileDialog.tsx) — dialog/sheet full-screen cu 6 sub-taburi:
1. **Date Personale** — CNP, CI, adresă (integrează `PersonalDataEditor` existent)
2. **Date Profesionale** — departament, funcție, grad, contract, data angajării, superior direct
3. **Cont și Acces** — status cont platformă, roluri, IP bypass
4. **Documente** — listă documente, upload, tip, status, cine a încărcat, expirare
5. **Concedii** — sold, istoric (integrează `EmployeeLeaveHistory`), carryover, bonus
6. **Istoric** — audit trail per angajat (filtrare `audit_logs` pe `entity_id`)

### 3. Employee Lifecycle (EmployeeLifecycle.tsx)

Wizard/acțiuni pentru ciclul de viață:
- **Onboarding** — checklist nou angajat (creare fișă, documente necesare, asociere cont)
- **Creare fișă angajat** — preia logica `showAddEmployee` din HRManagement
- **Asociere cont** — link angajat EPD cu profil existent (preia `syncEmployees`)
- **Schimbare departament/funcție** — formular rapid cu audit log
- **Arhivare** — preia logica existentă de arhivare cu motiv
- **Reactivare** — preia `restoreEmployee`
- **Încetare activitate** — arhivare cu motiv specific

### 4. Data Quality (DataQualityPanel.tsx)

Verificări automate cu badge-uri de severitate:
- Angajați fără email valid (email = `*@fara-email.local`)
- Profil fără angajat (profiles fără match în EPD)
- Angajat fără profil (EPD cu `employee_record_id` dar fără profil)
- Angajat fără rol (user_id există dar lipsă din `user_roles`)
- Duplicate CNP
- Funcție lipsă, departament lipsă, superior lipsă
- Date CI lipsă (`ci_series`, `ci_number` null)
- CNP lipsă sau invalid
- Inconsistențe employee_records vs employee_personal_data (total_leave_days diferit)

Fiecare categorie: count + listă expandabilă + acțiune rapidă de remediere.

### 5. Documents & Expirations (DocumentsExpirationsPanel.tsx)

**Categorii documente**: CI, contract, acte adiționale, diplome, adeverințe, fișe medicale, documente HR, scanări

**Tabel centralizat** cu:
- Angajat, tip document, nume, status (valid/expirat/lipsă/expiră curând), data upload, uploadat de, data expirare
- Filtre: tip, status, departament
- Upload rapid

**Alerte expirare**:
- CI expirate (din `ci_expiry_date`)
- Fișe medicale expirate (din `medical_dossiers.next_checkup_date`)
- Documente care expiră în 30/60/90 zile

**Reminder automat** — buton pentru a declanșa notificări batch.

### 6. HR Requests (HRRequestsInbox.tsx)

**Inbox unificat** combinând:
- `data_correction_requests` (cereri corecție date) — rutate către HR
- `hr_requests` WHERE `request_type = 'adeverinta'` — rutate către HR
- Preia și extinde `CorrectionRequestsManager` existent

**Coloane**: Solicitant, Tip cerere, Data, Status, Acțiuni rapide (Aprobă/Respinge/Notă)

**Filtre**: status (pending/approved/rejected), tip, perioadă

**Istoric decizii**: cine a rezolvat, când, notele admin

### 7. Notifications (HRNotificationsRules.tsx)

Panou de vizualizare reguli active:
- Cerere corecție date → notificare HR
- Cerere adeverință → notificare HR  
- Expirare fișă medicală → notificare `medic_medicina_muncii`
- Document lipsă → alertă dashboard HR
- Document care expiră curând → alertă dashboard HR

Afișare clară a rutărilor, fără editare (doar vizualizare reguli hardcodate).

## Eliminare rol `admin`

Fișiere afectate (schimbări punctuale):
- `src/hooks/useUserRole.tsx` — elimină `'admin'` din `AppRole` type și `validRoles`
- `src/App.tsx` — elimină `role === 'admin'` din `canBypassMaintenance`
- `src/pages/Admin.tsx` — verificări existente folosesc deja `super_admin`, dar auditez referințele
- Queries SQL/RLS cu `'admin'::app_role` rămân funcționale (rolul poate exista în DB dar nu e folosit în UI)

## Access Control

| Rol | Acces HR |
|---|---|
| `super_admin` | Tot — control complet |
| `sef_srus` | Tot — administrare completă modul HR |
| `hr` | Operațional HR — angajați, documente, cereri, rapoarte |
| `medic_medicina_muncii` | Doar zona medicală și alertele de fișe medicale |
| `sef` | Subordonații din departamentul propriu (read-only) |
| `user` | Propriile date, documente permise, cereri proprii |

## Design

- **Navigare**: 7 tab-uri cu iconuri, responsive (scroll horizontal pe mobil)
- **KPI Cards**: gradient pe icon, counter animat (useAnimatedCounter existent)
- **Tabele**: componenta Table din shadcn, hover states, sort headers
- **Dosar angajat**: Dialog full-width cu sub-taburi verticale pe desktop, orizontale pe mobil
- **Status badges**: culori consistente — emerald (ok), amber (warning), red (critical), blue (info)
- **Empty states**: icon + mesaj + acțiune sugerată
- **Loading**: skeleton shimmer pattern

## Pași de implementare

1. Elimină referințele la rolul `admin` din codebase (useUserRole, App.tsx)
2. Creează `HRDashboard.tsx` — KPI-uri cu queries reale + alerte + activitate
3. Creează `EmployeeFileDialog.tsx` — dosar angajat cu 6 sub-taburi
4. Creează `EmployeeHub.tsx` — listă angajați + integrare dosar
5. Creează `EmployeeLifecycle.tsx` — wizard ciclu de viață
6. Creează `DataQualityPanel.tsx` — audit calitate date
7. Creează `DocumentsExpirationsPanel.tsx` — documente centralizate + expirări
8. Creează `HRRequestsInbox.tsx` — inbox cereri HR unificat
9. Creează `HRNotificationsRules.tsx` — vizualizare reguli notificări
10. Refă `HRManagement.tsx` — shell cu 7 tab-uri, delegare la componente noi
11. Integrează taburile existente (Calendar, Import, Rapoarte, Adeverințe, Aprobatori) ca sub-secțiuni în zonele corespunzătoare

## Note tehnice

- **Nu sunt necesare migrații SQL** — toate datele există deja
- Logica existentă din HRManagement.tsx (fetchEmployees, saveEmployeeRecord, uploadDocument, etc.) este redistribuită în componentele noi, nu rescrisă
- Componentele existente (PersonalDataEditor, EmployeeLeaveHistory, CorrectionRequestsManager, etc.) sunt refolosite ca sub-componente
- Shared state (employees, loading) este gestionat prin props sau un context dedicat dacă e necesar

