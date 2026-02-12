

# Plan: Jurnal de Autentificare + Registru Inventar Echipamente

Ambele module vor fi accesibile exclusiv pentru **super_admin**, integrate ca tab-uri noi in pagina de Administrare.

---

## 1. Jurnal de Autentificare (Auth Log)

### Baza de date
Tabel nou: `auth_login_logs`
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `ip_address` (text)
- `user_agent` (text) - browser/dispozitiv complet
- `device_summary` (text) - rezumat scurt extras (ex: "Chrome / Windows")
- `login_at` (timestamptz, default now())
- `status` (text: 'success' | 'failed')
- `is_suspicious` (boolean, default false)

RLS: doar super_admin poate vedea (SELECT). Inserarea se face printr-un trigger/edge function securizat.

### Edge Function: `log-auth-event`
- Apelata dupa fiecare login reusit din frontend
- Primeste IP-ul din request headers (`x-forwarded-for`)
- Primeste user_agent din request headers
- Parseaza device_summary din user agent string
- Detecteaza login suspect: IP diferit de ultimele 3 login-uri sau user agent complet nou
- Daca e suspect, seteaza `is_suspicious = true` si creeaza o notificare pentru toti super_admins

### Frontend: componenta `AuthLoginLog.tsx`
- Tabel paginat cu: Data/Ora, Utilizator, IP, Dispozitiv, Status, Badge "Suspect"
- Filtrare dupa: utilizator, doar suspecte, interval de date
- Badge rosu pentru login-uri suspecte
- Integrat ca tab "Autentificari" in Admin.tsx

### Integrare in `useAuth.tsx`
- Dupa `signIn` reusit, apel catre edge function `log-auth-event`

---

## 2. Registru Inventar Echipamente

### Baza de date

**Tabel: `equipment_items`**
- `id` (uuid, PK)
- `name` (text, NOT NULL) - denumire echipament
- `category` (text) - laptop, card_acces, cheie, telefon, altele
- `serial_number` (text) - numar serie/identificare
- `description` (text)
- `status` (text: 'available', 'assigned', 'in_repair', 'decommissioned')
- `assigned_to_user_id` (uuid, nullable) - cui e atribuit
- `assigned_at` (timestamptz)
- `created_by` (uuid)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Tabel: `equipment_history`**
- `id` (uuid, PK)
- `equipment_id` (uuid, FK -> equipment_items)
- `action` (text: 'assigned', 'returned', 'transferred', 'repair', 'decommissioned')
- `from_user_id` (uuid, nullable)
- `to_user_id` (uuid, nullable)
- `performed_by` (uuid) - cine a facut actiunea
- `notes` (text)
- `created_at` (timestamptz)

RLS pe ambele tabele: doar `super_admin` poate SELECT, INSERT, UPDATE, DELETE.

### Frontend: componenta `EquipmentRegistry.tsx`
- Lista echipamente cu: Denumire, Categorie, Serie, Status (badge colorat), Atribuit la
- Formular adaugare/editare echipament (dialog)
- Buton "Atribuie" - selecteaza angajat din lista profiles
- Buton "Returneaza" - marcheaza disponibil
- Buton "Transfera" - muta de la un angajat la altul
- Fiecare actiune se logheaza automat in `equipment_history`
- Expandare rand -> istoricul complet al echipamentului
- Filtre: dupa categorie, status, angajat
- Integrat ca tab "Inventar" in Admin.tsx

---

## 3. Modificari in Admin.tsx

Doua tab-uri noi:
- **"Autentificari"** -> AuthLoginLog
- **"Inventar"** -> EquipmentRegistry

---

## Detalii tehnice

### Fisiere noi:
- `supabase/functions/log-auth-event/index.ts`
- `src/components/admin/AuthLoginLog.tsx`
- `src/components/admin/EquipmentRegistry.tsx`

### Fisiere modificate:
- `src/hooks/useAuth.tsx` - apel log-auth-event dupa login
- `src/pages/Admin.tsx` - 2 tab-uri noi

### Migratii SQL:
- Creare `auth_login_logs` cu RLS super_admin only
- Creare `equipment_items` + `equipment_history` cu RLS super_admin only

