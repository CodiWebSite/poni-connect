

# Import Centralizat din XLS cu Potrivire Email

## Ce facem

Transformam complet sistemul de import pentru a accepta fisierul XLS exact asa cum il aveti, cu toate sheet-urile pe departamente (Lab1, Lab2, ..., SRUS, Audit etc.). Sistemul va:

1. Citi automat fiecare sheet si extrage departamentul din header
2. Parsa angajatii cu: nume, CNP, functie, grad, zile CO cuvenite
3. Calcula automat zilele de concediu folosite din coloanele cu intervale
4. Accepta un al doilea fisier (XLS sau CSV) cu emailuri si nume pentru potrivire
5. Afisa un tabel de previzualizare unde puteti verifica si corecta emailurile inainte de import

## Fluxul de lucru

```text
+---------------------------+      +---------------------------+
| 1. Incarcati XLS-ul       |      | 2. Incarcati fisierul     |
|    cu angajati             |      |    cu emailuri            |
|    (toate sheet-urile)     |      |    (nume -> email)        |
+---------------------------+      +---------------------------+
            |                                   |
            +-----------------------------------+
            |
    +-------v-----------+
    | 3. Previzualizare  |
    |    - Departament   |
    |    - Nume          |
    |    - CNP           |
    |    - Functie       |
    |    - Email (editable) |
    |    - Zile CO       |
    |    - Zile folosite |
    +-------------------+
            |
    +-------v-----------+
    | 4. Import in baza  |
    |    de date         |
    +--------------------+
```

## Detalii tehnice

### 1. Migrare baza de date

Se adauga 5 coloane noi la tabela `employee_personal_data`:
- `department` (text, nullable) -- departamentul din sheet
- `position` (text, nullable) -- functia + grad (ex: "CS III", "ACS", "referent II")
- `contract_type` (text, default 'nedeterminat')
- `total_leave_days` (integer, default 21) -- Nr. zile CO cuvenite
- `used_leave_days` (integer, default 0) -- calculat din intervale

Se actualizeaza functia trigger `sync_employee_on_signup()` sa preia si aceste valori noi cand un angajat isi face cont. Trigger-ul va seta:
- `profiles.department` si `profiles.position`
- `employee_records.total_leave_days` si `employee_records.used_leave_days`
- `employee_records.contract_type`

Se actualizeaza si functia `sync_existing_employees()` cu aceeasi logica.

### 2. Componenta `EmployeeImport.tsx` -- rescriere completa

**Pasul 1: Upload XLS angajati**
- Accept `.xls` si `.xlsx`
- Parseaza cu biblioteca `xlsx` (deja instalata)
- Citeste fiecare sheet: numele sheet-ului sau primul rand cu text identifica departamentul
- Din fiecare sheet, extrage randurile de angajati:
  - Coloana B: Nume (format "PRENUME NUME" -- splitare automata)
  - Coloana C: CNP
  - Coloana F: Functia (CS, ACS, CS-CD, referent, Inspector sp.)
  - Coloana G: Grad/treapta (I, II, III, IA)
  - Coloana N: Nr. zile CO cuvenite (total leave days)
  - Coloanele Q, S, U...: Nr. zile CO (se aduna pentru used_leave_days)
- Ignora randurile goale, header-uri, sectiunea "Doctoranzi" (se importa si ei cu 21 zile CO)

**Pasul 2: Upload fisier emailuri**
- Accepta XLS sau CSV cu minim 2 coloane: nume si email
- Potrivire automata dupa nume (comparatie case-insensitive, cu toleranta la diacritice)
- Afisare status potrivire: verde (gasit), rosu (negasit)

**Pasul 3: Previzualizare si editare**
- Tabel cu toti angajatii parsati
- Coloana email editabila manual
- Filtru pe departament
- Buton "Importa" activ doar dupa ce emailurile sunt completate

### 3. Edge function `import-employees` -- actualizare

- Accepta JSON array in loc de CSV
- Fiecare element: `{ email, first_name, last_name, cnp, department, position, contract_type, total_leave_days, used_leave_days, employment_date }`
- Upsert in `employee_personal_data` dupa `cnp` (mai fiabil decat email)
- Adaugare conflict pe `cnp` in plus fata de `email`

### 4. Edge function `sync-employees` -- actualizare

La sincronizare, preia si datele noi din `employee_personal_data`:
- `department` -> `profiles.department`
- `position` -> `profiles.position`
- `total_leave_days` -> `employee_records.total_leave_days`
- `used_leave_days` -> `employee_records.used_leave_days`
- `contract_type` -> `employee_records.contract_type`

### 5. Logica parsare XLS

Detectare coloane prin cautare in header-ul fiecarui sheet:
- Se cauta "Nume si prenume" -> coloana cu numele
- Se cauta "CNP" -> coloana CNP
- Se cauta "Functia" -> coloana pozitie
- Se cauta "Grad" -> coloana grad
- Se cauta "Nr. zile CO cuvenite" -> total leave days
- Se cauta "Nr. zile CO" (coloanele repetate dupa) -> used leave days (suma)
- Departamentul se ia din: randul cu "Laborator X -..." sau din numele sheet-ului

Calculul zilelor folosite: se aduna toate valorile numerice din coloanele "Nr. zile CO" (cele repetate, dupa coloana cu zile cuvenite).

## Fisiere modificate

- `supabase/migrations/` -- migrare SQL noua (coloane + trigger actualizat)
- `src/components/hr/EmployeeImport.tsx` -- rescriere completa (upload XLS + emailuri + previzualizare)
- `supabase/functions/import-employees/index.ts` -- accepta JSON, campuri noi
- `supabase/functions/sync-employees/index.ts` -- sincronizare campuri noi

## Format fisier emailuri

Fisierul cu emailuri poate fi:
- **XLS/XLSX** cu coloane: Nume | Email
- **CSV** cu separator `;`: `nume;email`

Exemplu:
```text
PINTEALA MARIANA;pinteala.mariana@icmpp.ro
AL-MATARNEH MARIA-CRISTINA;almatarneh.maria@icmpp.ro
ARVINTE ADINA;arvinte.adina@icmpp.ro
```

