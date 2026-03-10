

# Modul Medicină a Muncii

## Rezumat

Un modul dedicat medicului de medicina muncii, cu fișe medicale digitale per angajat, programări automate pentru controale periodice, alerte de expirare avize și rapoarte statistice. HR-ul va vedea doar statusul avizelor (apt/inapt/expirat), fără acces la dosarele medicale complete.

## Rol nou: `medic_medicina_muncii`

Se adaugă în enum-ul `app_role` un nou rol dedicat. Medicul va avea acces complet la modul, iar HR-ul va vedea doar un subset limitat (statusuri avize).

## Tabele noi

### 1. `medical_records` — Dosarul medical per angajat
| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | uuid PK | |
| epd_id | uuid FK → employee_personal_data | Legătura cu angajatul |
| medical_fitness | enum: apt, apt_conditionat, inapt, pending | Status aviz |
| fitness_valid_until | date | Data expirare aviz |
| risk_category | text | Categoria de risc (ex: chimic, biologic) |
| chronic_conditions | text | Afecțiuni cronice (criptat/acces doar medic) |
| restrictions | text | Restricții medicale |
| notes | text | Observații medic |
| created_by | uuid | Medicul care a creat |
| created_at, updated_at | timestamptz | |

**RLS**: Medicul — acces complet. HR — SELECT doar pe coloanele: epd_id, medical_fitness, fitness_valid_until, restrictions. Angajatul — SELECT pe propriul dosar (limitat la fitness + restricții).

### 2. `medical_consultations` — Istoric consultații
| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | uuid PK | |
| medical_record_id | uuid FK | |
| consultation_type | enum: angajare, periodic, reluare, urgenta, altele | Tipul controlului |
| consultation_date | date | |
| diagnosis | text | Diagnostic |
| recommendations | text | Recomandări |
| next_consultation_date | date | Data următorului control |
| doctor_id | uuid | Medicul |
| created_at | timestamptz | |

**RLS**: Doar medicul — acces complet.

### 3. `medical_scheduled_exams` — Programări controale periodice
| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | uuid PK | |
| epd_id | uuid FK | |
| exam_type | text | Tipul examenului |
| scheduled_date | date | |
| status | enum: scheduled, completed, missed, cancelled | |
| notes | text | |
| created_by | uuid | |
| created_at, updated_at | timestamptz | |

**RLS**: Medicul — acces complet. HR — SELECT only.

### 4. `medical_documents` — Documente scanate
| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | uuid PK | |
| medical_record_id | uuid FK | |
| document_type | text | (aviz, analize, fișă aptitudine) |
| file_url | text | Cale în storage |
| uploaded_by | uuid | |
| created_at | timestamptz | |

**RLS**: Doar medicul — acces complet.

## Storage

Bucket privat nou: `medical-documents` (public: false). RLS pe `storage.objects`: doar utilizatorii cu rolul `medic_medicina_muncii` pot citi/scrie.

## Pagini și componente UI

### Pagină principală: `/medicina-muncii`
- **Dashboard medic**: Vizualizare de ansamblu cu avize care expiră curând, programări viitoare, statistici
- **Lista angajaților**: Tabel cu toți angajații, status aviz (colorat: verde=apt, galben=conditionat, roșu=inapt/expirat), filtru departament
- **Fișa medicală** (click pe angajat): Tab-uri cu date medicale, istoric consultații, documente, programări
- **Calendar programări**: Vizualizare lunară a controalelor planificate

### Pentru HR: `/medicina-muncii/status`
- Vizualizare limitată: doar tabel cu angajat, status aviz, dată expirare, restricții
- Fără acces la diagnostice, note medicale sau documente

### Sidebar
- Intrare nouă vizibilă doar pentru rolul `medic_medicina_muncii` și HR (cu badge pentru avize expirate)

## Alerte automate

### Edge Function: `check-medical-expirations`
- Cron zilnic care verifică avizele care expiră în 30/15/7 zile
- Trimite notificări in-app medicului + email
- Trimite notificare HR când un aviz a expirat efectiv

### Notificări in-app
- Medicul primește alertă pentru fiecare angajat cu aviz aproape de expirare
- HR-ul primește alertă doar când avizul a expirat (pentru a nu programa angajatul la lucru fără aviz valid)

## Rapoarte și statistici

- **Rata de acoperire**: % angajați cu aviz valid vs total
- **Distribuție pe departamente**: Grafic cu status avize per departament
- **Controale efectuate**: Număr consultații pe lună/trimestru
- **Angajați cu restricții active**: Listă filtrabilă
- **Export Excel**: Export complet al statusurilor pentru raportări oficiale

## Securitate

- Datele medicale sunt **strict confidențiale** — RLS separat de restul sistemului
- HR-ul NU vede diagnostice, note sau documente medicale
- Funcția `can_manage_medical()` — SECURITY DEFINER, verifică rolul `medic_medicina_muncii`
- Funcția `can_view_medical_status()` — pentru HR, returnează doar statusul avizului
- Audit log pe fiecare acces la fișe medicale

## Plan de implementare

1. Migrație DB: enum nou, 4 tabele, funcții RLS, bucket storage
2. Pagină principală medicină muncii cu dashboard și lista angajaților
3. Fișa medicală per angajat cu tab-uri
4. Sistem programări cu calendar
5. Alerte expirare (edge function + cron)
6. Vizualizare limitată HR
7. Rapoarte și export
8. Intrare sidebar + rutare

