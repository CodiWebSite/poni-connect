

## Plan: Separare Funcție și Grad/Treaptă (fără a afecta angajații arhivați)

### Problema
Parserul XLS confundă coloana "Grad/Treaptă" (ex: I, II, III) cu "Gradație vechime" (ex: 3, 4, 5) deoarece ambele conțin cuvântul "grad". In plus, funcția și gradul sunt lipite într-un singur câmp `position`.

### Garanția pentru angajații arhivați
Importul folosește `upsert` pe CNP. Câmpul `is_archived` **nu** e inclus în payload, deci rămâne neatins. Totuși, vom adăuga o protecție suplimentară: funcția edge de import va **exclude** angajații arhivați de la actualizare (nu le va modifica nici funcția, nici gradul, nimic).

### Modificări

**1. Migrare SQL** — adăugare coloană `grade` în `employee_personal_data`:
```sql
ALTER TABLE employee_personal_data ADD COLUMN grade text;
```

**2. Parser XLS** (`src/utils/parseEmployeeXls.ts`):
- Linia 189: excludem "gradație" din detectare:
  ```
  (val.includes('grad') || val.includes('treapta')) && !val.includes('gradati')
  ```
- Adăugăm `grade: string` în interfața `ParsedEmployee`
- Liniile 402-414: stocăm funcția în `position` și gradul separat în `grade` (nu le mai lipim)

**3. Componenta de import** (`src/components/hr/EmployeeImport.tsx`):
- Trimitem `grade` separat în payload
- Adăugăm coloana "Grad" în tabelul de previzualizare

**4. Funcția edge de import** (`supabase/functions/import-employees/index.ts`):
- Acceptăm câmpul `grade`
- **Protecție**: la upsert, sărim peste angajații care au `is_archived = true` (verificare înainte de insert/update)

**5. Pagina HR Management** (`src/pages/HRManagement.tsx`):
- Afișăm "Funcție" și "Grad/Treaptă" ca două câmpuri separate
- Câmp editabil pentru grad în formularul de editare

**6. Editor date personale** (`src/components/hr/PersonalDataEditor.tsx`):
- Câmp separat "Grad/Treaptă" lângă "Funcție"

**7. Export HR** (`src/components/hr/HRExportButton.tsx`):
- Coloană separată "Grad/Treaptă" în export

**8. Profil** (`src/pages/MyProfile.tsx`):
- Afișăm gradul separat lângă funcție

### Ce rămâne neatins
- Angajații arhivați nu sunt modificați la re-import
- Câmpul `position` existent rămâne cu valoarea actuală
- La re-import, noua logică va popula corect `position` (doar funcția) și `grade` (doar gradul)
- Toate funcționalitățile existente continuă să funcționeze

