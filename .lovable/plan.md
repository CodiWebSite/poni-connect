

# Plan: Export Rapoarte HR + Audit Log + Grafic Activare Conturi

## 1. Export Rapoarte HR in Excel (imbunatatit)

Pagina HR Management are deja un export basic (`exportLeaveReport`). Vom adauga un component `HRExportButton` cu un dropdown care ofera mai multe rapoarte:

- **Situatia concediilor** -- toti angajatii cu sold concediu (total/utilizate/ramase), departament, contract
- **Angajati fara cont** -- lista doar a angajatilor care nu au cont activ (hasAccount === false), cu email, departament, pozitie
- **Angajati cu cont** -- lista angajatilor cu cont activ
- **Toate cererile HR** -- export al tuturor cererilor HR (concediu, delegatie, adeverinta, demisie) cu status

Se va folosi biblioteca `xlsx` deja instalata. Butonul va fi adaugat in header-ul tab-ului "Angajati" din `HRManagement.tsx`.

## 2. Audit Log Detaliat pentru Admin

### Baza de date
Se va crea un tabel nou `audit_logs` cu urmatoarele coloane:
- `id` (uuid, PK)
- `user_id` (uuid) -- cine a facut actiunea
- `action` (text) -- tipul actiunii (ex: "role_change", "employee_edit", "leave_approve", "user_delete")
- `entity_type` (text) -- tipul entitatii afectate (ex: "user_role", "employee_record", "hr_request")
- `entity_id` (text) -- ID-ul entitatii
- `details` (jsonb) -- detalii suplimentare (old_value, new_value, etc.)
- `created_at` (timestamptz)

Politici RLS: doar admin/super_admin pot citi; inserarea se face prin functie SECURITY DEFINER.

### Functie DB
O functie `log_audit_event(...)` SECURITY DEFINER care permite inserarea din orice context autentificat.

### UI
Un nou tab sau sectiune in pagina Admin (`/admin`) cu:
- Tabel cu ultimele actiuni (paginat)
- Filtre pe tip actiune, utilizator, data
- Badge-uri colorate pe tipul actiunii

### Logging
Se vor adauga apeluri de logging in actiunile existente:
- Schimbare rol utilizator (Admin.tsx)
- Stergere cont (Admin.tsx)
- Aprobare/respingere cereri HR
- Editare date angajat (HRManagement.tsx)

## 3. Grafic Evolutie Activare Conturi

Pe Dashboard-ul admin, sub cardul de activare conturi, se va adauga un grafic cu `recharts` (deja instalat):

- Tip: Area/Line chart
- Axe: data pe X, numar conturi activate pe Y
- Date: se va folosi `employee_records.created_at` ca proxy pentru data activarii contului
- Se grupeaza pe luna/saptamana
- Se va afisa si linia de total angajati pentru context

---

## Detalii Tehnice

### Fisiere noi:
1. `src/components/hr/HRExportButton.tsx` -- componenta dropdown export (inlocuieste exportul simplu existent)
2. `src/components/admin/AuditLog.tsx` -- componenta audit log
3. `src/components/dashboard/ActivationChart.tsx` -- grafic evolutie activare

### Fisiere modificate:
1. `src/pages/HRManagement.tsx` -- inlocuire buton export simplu cu `HRExportButton`
2. `src/pages/Admin.tsx` -- adaugare tab/sectiune Audit Log
3. `src/pages/Dashboard.tsx` -- adaugare grafic activare sub cardul existent

### Migrare SQL:
```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Doar admin/super_admin pot citi
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'super_admin'::app_role));

-- Functie SECURITY DEFINER pentru inserare
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _user_id uuid,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, _action, _entity_type, _entity_id, _details);
END;
$$;
```

### Grafic activare -- logica:
- Query `employee_records` grupat pe `DATE_TRUNC('month', created_at)`
- Afisare cu `AreaChart` din recharts
- Total cumulativ pe fiecare luna

