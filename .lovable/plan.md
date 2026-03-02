

## Plan: Modul Salarizare -- Rol dedicat cu acces exclusiv

### Rezumat

Se creează un rol nou `salarizare` in baza de date, o pagina dedicata `/salarizare` vizibila DOAR pentru utilizatorii cu acest rol (nu si super_admin), si se scoate optiunea "Raport salarizare" din HRExportButton.

### 1. Migrare SQL

```sql
-- Adaugare rol nou
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'salarizare';

-- Functie de verificare
CREATE OR REPLACE FUNCTION public.can_manage_salarizare(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'salarizare'
  )
$$;

-- RLS: rolul salarizare poate citi employee_personal_data
CREATE POLICY "Salarizare can view EPD"
ON public.employee_personal_data FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

-- RLS: rolul salarizare poate citi leave_requests
CREATE POLICY "Salarizare can view leave requests"
ON public.leave_requests FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

-- RLS: rolul salarizare poate citi employee_records
CREATE POLICY "Salarizare can view employee records"
ON public.employee_records FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

-- RLS: rolul salarizare poate citi leave_carryover
CREATE POLICY "Salarizare can view leave carryover"
ON public.leave_carryover FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

-- RLS: rolul salarizare poate citi leave_bonus
CREATE POLICY "Salarizare can view leave bonus"
ON public.leave_bonus FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

-- RLS: rolul salarizare poate citi profiles
CREATE POLICY "Salarizare can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));
```

Update `handle_new_user` -- adaugare label "Salarizare" in CASE.

### 2. Modificari cod

**`src/hooks/useUserRole.tsx`**
- Adaugare `'salarizare'` in lista de roluri valide
- Export `isSalarizare` computed property

**`src/components/layout/Sidebar.tsx`**
- Adaugare intrare `Salarizare` cu icon `Banknote`, vizibila DOAR daca `isSalarizare` (nu si super_admin)
- Plasare in sectiunea de management

**`src/components/layout/MobileNav.tsx`**
- Aceeasi intrare pentru mobile

**`src/App.tsx`**
- Adaugare ruta `/salarizare` -> `Salarizare`

**`src/pages/Salarizare.tsx`** (NOU)
- Verificare rol: daca nu e `salarizare`, redirect la `/`
- UI cu 3 butoane de export XLSX:
  1. **Luna precedenta** -- un sheet cu angajatii A-Z si concediile din luna precedenta (zile + perioade)
  2. **Concedii 2025** -- 12 sheet-uri (Ian-Dec 2025), fiecare cu angajatii si concediile lunii respective
  3. **Concedii 2026** -- 12 sheet-uri (Ian-Dec 2026), fiecare cu angajatii si concediile lunii respective
- Datele se iau din `employee_personal_data` + `leave_requests` (approved) + `leave_carryover` + `leave_bonus`
- Se reutilizeaza logica de stil Excel din HRExportButton (HEADER_FILL, styleSheet, etc.)

**`src/components/hr/HRExportButton.tsx`**
- Scoatere optiunea "Raport salarizare (CO/luna)" din dropdown (liniile 432-435)

### 3. Structura XLSX

```text
Export "Luna precedenta (Feb 2026)":
Sheet: "Feb 2026"
| Nr | Nume        | Dept   | Functie | Zile CO | Perioade    |

Export "Concedii 2025":
Sheet: "Ianuarie 2025" ... "Decembrie 2025" (12 sheets)
| Nr | Nume        | Dept   | Functie | Zile CO | Perioade    |

Export "Concedii 2026":  
Sheet: "Ianuarie 2026" ... "Decembrie 2026" (12 sheets)
| Nr | Nume        | Dept   | Functie | Zile CO | Perioade    |
```

### 4. Fișiere afectate

- **Nou**: `src/pages/Salarizare.tsx`
- **Modificat**: `src/hooks/useUserRole.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileNav.tsx`, `src/App.tsx`, `src/components/hr/HRExportButton.tsx`
- **Migrare DB**: rol + functie + 6 politici RLS + update handle_new_user

