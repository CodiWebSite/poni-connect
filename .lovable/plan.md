

# Sistem Cerere Concediu de Odihna - Plan de Implementare

## Rezumat
Construim un sistem complet de depunere si aprobare a cererilor de concediu de odihna, cu generare automata de document conform modelului ICMPP, flux de aprobare in mai multi pasi, si semnatura electronica. Initial, sectiunea va fi accesibila doar pentru **Super Admin** in scop de testare.

## Fluxul Principal

```text
Angajat completeaza cererea
        |
        v
Cererea pleaca la DIRECTOR
        |
   Aproba / Respinge
        |
        v (daca aprobat)
Pleaca la SEF COMPARTIMENT
        |
   Aproba / Respinge
        |
        v (daca aprobat)
Ajunge in GESTIUNE HR (centralizat)
        |
   Se scade automat din sold
   Se poate descarca/printa DOCX
```

## Ce va contine cererea (auto-completat)

Din datele existente in sistem se vor completa automat:
- Numele si prenumele angajatului
- Functia (pozitia)
- Compartimentul (departamentul)
- Numarul de zile solicitate (calculat automat din perioada selectata, exclus weekenduri si sarbatori)
- Anul aferent
- Data de inceput
- Soldul de concediu (zile disponibile, reportate, bonus)

Angajatul completeaza manual:
- **Perioada** (data inceput - data sfarsit)
- **Inlocuitor** (selecteaza din lista colegilor din acelasi departament)

## Documentul DOCX

Se genereaza exact conform modelului ICMPP "Anexa 11.2.-P.O. ICMPP-SRUS":
- Antet: ACADEMIA ROMANA / INSTITUTUL DE CHIMIE MACROMOLECULARA "PETRU PONI"
- Sectiune "Se aproba" (Director) si "Aprobat" (Sef compartiment) - cu semnatura olografa si stampila prestabilite
- Corpul cererii cu toate datele auto-completate
- Sectiunea SRUS (soldul de zile, semnatura salariat SRUS)
- Semnatura electronica a angajatului + data

## Semnatura Electronica Angajat

Se va folosi componenta `SignaturePad` existenta in proiect. Angajatul semneaza electronic la momentul depunerii cererii. Data si ora se inregistreaza automat.

## Semnatura Olografa Director si Sef Compartiment

Acestea vor fi **imagini pre-incarcate** in storage (semnatura + stampila). Se vor afisa pe document cand cererea este aprobata de fiecare.

---

## Detalii Tehnice

### 1. Tabel nou: `leave_requests`

| Coloana | Tip | Descriere |
|---------|-----|-----------|
| id | uuid | PK |
| user_id | uuid | Angajatul care depune |
| epd_id | uuid | Link la employee_personal_data |
| request_number | text | Numar auto-generat (CO-2026-0001) |
| start_date | date | Data inceput concediu |
| end_date | date | Data sfarsit concediu |
| working_days | integer | Zile lucratoare calculate |
| year | integer | Anul aferent |
| replacement_name | text | Numele inlocuitorului |
| replacement_position | text | Functia inlocuitorului |
| status | text | draft/pending_director/pending_department_head/approved/rejected |
| employee_signature | text | Semnatura base64 angajat |
| employee_signed_at | timestamptz | Data semnare |
| director_id | uuid | Directorul care aproba |
| director_approved_at | timestamptz | Data aprobare director |
| director_notes | text | Note director |
| dept_head_id | uuid | Seful de compartiment |
| dept_head_approved_at | timestamptz | Data aprobare sef |
| dept_head_notes | text | Note sef compartiment |
| rejected_by | uuid | Cine a respins |
| rejected_at | timestamptz | Data respingere |
| rejection_reason | text | Motivul respingerii |
| created_at | timestamptz | Data creare |
| updated_at | timestamptz | Data actualizare |

### 2. Politici RLS

- Angajatii pot crea cereri proprii si le pot vedea
- Angajatii pot sterge cereri in status `draft`
- Directorii (director_institut, director_adjunct) pot vedea si actualiza cereri in status `pending_director`
- Sefii de departament (sef, sef_srus) pot vedea si actualiza cereri in status `pending_department_head`
- HR (super_admin, hr, sef_srus) poate vedea toate cererile

### 3. Componente Noi

**`src/pages/LeaveRequest.tsx`** - Pagina principala (ruta: `/leave-request`)
- Formular de depunere cerere (pentru angajat)
- Lista cererilor proprii cu statusuri
- Tab de aprobare (pentru director/sef)
- Tab centralizat HR (pentru super_admin/hr)

**`src/components/leave/LeaveRequestForm.tsx`** - Formularul de cerere
- Selectie perioada cu calendar
- Calcul automat zile lucratoare (exclus weekenduri, sarbatori legale, custom holidays)
- Selectie inlocuitor din colegii de departament
- Preview document in timp real
- SignaturePad pentru semnatura angajat

**`src/components/leave/LeaveRequestDocument.tsx`** - Previzualizare document HTML
- Replica exacta a modelului ICMPP
- Afisare conditionala semnaturi (angajat, director, sef)

**`src/utils/generateLeaveDocx.ts`** - Generator DOCX
- Document Word generat cu biblioteca `docx` (deja instalata)
- Format identic cu modelul ICMPP

**`src/components/leave/LeaveApprovalPanel.tsx`** - Panou aprobare
- Lista cereri de aprobat (pentru director/sef)
- Buton Aproba/Respinge cu optional motiv
- Previzualizare document

**`src/components/leave/LeaveRequestsHR.tsx`** - Centralizare HR
- Tabel cu toate cererile aprobate
- Descarcare individuala si bulk DOCX
- Filtre pe departament, perioada, status

### 4. Flux de Aprobare (detaliat)

1. **Angajat depune** - status: `pending_director`
   - Se trimite notificare la toti utilizatorii cu rol `director_institut` / `director_adjunct`

2. **Director aproba** - status: `pending_department_head`
   - Se trimite notificare la seful departamentului angajatului
   - Daca respinge: status `rejected`, notificare la angajat

3. **Sef compartiment aproba** - status: `approved`
   - Se scade automat din soldul de concediu (`used_leave_days` in `employee_records` si `employee_personal_data`)
   - Se trimite notificare la angajat: "Cererea a fost aprobata"
   - Se trimite notificare la HR
   - Daca respinge: status `rejected`, notificare la angajat

### 5. Accesibilitate pentru Testare

Initial, ruta `/leave-request` va fi accesibila **doar pentru Super Admin**. Dupa validare, se va deschide pentru toti angajatii.

### 6. Integrare cu Sidebar/Navigatie

Se adauga un link nou in sidebar: "Cerere Concediu" cu iconita `FileText`, vizibil doar pentru Super Admin in faza de testare.

### 7. Fisiere Modificate/Create

| Fisier | Actiune |
|--------|---------|
| `supabase/migrations/...` | Creare tabel `leave_requests` + RLS + sequence |
| `src/pages/LeaveRequest.tsx` | NOU - Pagina principala |
| `src/components/leave/LeaveRequestForm.tsx` | NOU - Formular |
| `src/components/leave/LeaveRequestDocument.tsx` | NOU - Preview document |
| `src/components/leave/LeaveApprovalPanel.tsx` | NOU - Panou aprobare |
| `src/components/leave/LeaveRequestsHR.tsx` | NOU - Centralizare HR |
| `src/utils/generateLeaveDocx.ts` | NOU - Generator DOCX |
| `src/App.tsx` | Adaugare ruta `/leave-request` |
| `src/components/layout/Sidebar.tsx` | Adaugare link navigatie (doar super_admin) |

