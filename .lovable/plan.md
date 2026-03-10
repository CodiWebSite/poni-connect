

# Arhivă Online — Restricționată pe Departamente

## Concept

Fiecare departament are propria secțiune de arhivă. Un angajat din Contabilitate vede doar documentele arhivate de departamentul Contabilitate. HR/Super Admin văd totul. Upload-ul este permis oricărui utilizator autentificat, dar documentul se atașează automat departamentului utilizatorului curent.

## Schema bazei de date

### Tabel: `archive_documents`

| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | uuid PK | |
| registration_number | text UNIQUE | Auto-generat: ARH-YYYY-NNNN |
| department | text NOT NULL | Departamentul care deține documentul (preluat automat din profilul uploaderului) |
| nomenclator_category | text NOT NULL | Categoria din nomenclator (Acte personal, Financiar-contabile, Contracte, etc.) |
| retention_years | integer NOT NULL | Termen păstrare (5, 10, 25, 50, 100=permanent) |
| retention_expires_at | date | Calculat: archived_at + retention_years |
| file_url | text | URL fișier din storage |
| file_name | text | Numele original al fișierului |
| file_size | bigint | Dimensiune |
| description | text | Descriere document |
| uploaded_by | uuid | Cine a încărcat |
| archived_at | timestamptz | Data arhivării (default now()) |
| created_at | timestamptz | |

### Tabel: `archive_access_log`

| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | uuid PK | |
| document_id | uuid FK → archive_documents | |
| user_id | uuid | Cine a accesat |
| action | text | view / download |
| accessed_at | timestamptz | |

### Storage bucket: `archive-documents` (privat)

### RLS — Securitate pe departament

Reutilizăm funcția existentă `get_user_department(auth.uid())` pentru a compara departamentul utilizatorului cu cel al documentului:

```sql
-- Funcție helper: verifică dacă userul e din același departament cu documentul
CREATE OR REPLACE FUNCTION public.archive_same_department(_doc_department text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _doc_department = get_user_department(auth.uid());
$$;
```

**Politici RLS pe `archive_documents`:**
- **SELECT**: `archive_same_department(department) OR can_manage_hr(auth.uid())` — vezi doar documentele departamentului tău, HR/admin văd tot
- **INSERT**: `archive_same_department(department)` — poți adăuga doar în departamentul tău
- **DELETE**: `can_manage_hr(auth.uid()) AND retention_expires_at <= now()` — doar HR, doar dacă termenul a expirat

**Politici RLS pe `archive_access_log`:**
- **INSERT**: autentificat, `user_id = auth.uid()`
- **SELECT**: `can_manage_hr(auth.uid())` — doar HR vede jurnalul

**Politici storage `archive-documents`:**
- Upload/download restricționat la autentificați (verificarea departamentală se face la nivel de tabel, nu storage)

## Frontend

### Pagină nouă: `/arhiva` — `src/pages/Archive.tsx`

**Structură:**
1. **Header** cu titlu "Arhivă Online" + referință Legea 16/1996
2. **Statistici rapide**: total documente departament, pe categorii, termen expirat
3. **Tabel principal** cu filtre:
   - Căutare text (nume, descriere, nr. înregistrare)
   - Filtru categorie nomenclator
   - Filtru termen păstrare
   - HR/Admin: filtru suplimentar pe departament (pentru a vedea alte departamente)
4. **Buton Upload** — dialog cu: fișier, categorie nomenclator, termen păstrare, descriere
   - Departamentul se setează automat din profilul utilizatorului
5. **Descărcare** — logată automat în `archive_access_log`
6. **Protecție ștergere** — butonul apare doar dacă termenul a expirat și userul e HR

### Categorii nomenclator predefinite:
- Acte de personal (Permanent)
- Documente financiar-contabile (10 ani)
- Corespondență oficială (5 ani)
- Contracte (10 ani)
- Rapoarte de activitate (Permanent)
- Procese verbale (Permanent)
- Decizii și dispoziții (Permanent)
- Documentație cercetare (Permanent)
- Alte documente (5 ani)

### Sidebar
- Intrare "Arhivă Online" cu icon `Archive`, vizibilă tuturor utilizatorilor autentificați

### Routing
- Rută `/arhiva` în `App.tsx`

## Rezumat securitate

- Angajatul vede **doar** documentele departamentului său
- HR / Super Admin văd **toate** departamentele
- Ștergerea este blocată până la expirarea termenului de păstrare
- Fiecare descărcare este logată conform legii

