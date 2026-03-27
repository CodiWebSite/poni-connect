

## Sistem Avansat de Inventariere IT — Plan Actualizat

### Structura fișierului Excel (2 sheet-uri)

**Sheet 1 — `inventar_echipamente`:**
Clădire, Etaj, Nr. Încăpere, Tip echipament, Brand/Model, Nr. inventar, Serie, Status, Observații

**Sheet 2 — `Software_calculatoare`:**
Clădire, Etaj, Încăpere, Tip activitate, Nr. inventar PC, Nume PC, Sistem de operare, An licență, Tip licență, Antivirus, An antivirus, Aplicații instalate, Licențiate, Observații

### Ce există acum
- Tabel `equipment_items` cu: name, category, serial_number, description, status, assigned_to_user_id
- Categorii limitate: laptop, card_acces, cheie, telefon, altele
- Doar Super Admin, RLS deja configurat

---

### Planul de implementare

#### 1. Extindere baza de date (2 migrări)

**Extindere `equipment_items`** — coloane noi:
- `building` (text) — Clădire
- `floor` (integer) — Etaj
- `room` (text) — Nr. Încăpere
- `brand_model` (text) — Brand/Model
- `inventory_number` (text, unique) — Nr. inventar
- `qr_pin_hash` (text) — PIN hash pentru acces QR

**Tabel nou `equipment_software`:**
- `id`, `equipment_id` (FK → equipment_items), `activity_type` (Cercetare etc.)
- `pc_name`, `os`, `license_year`, `license_type` (Retail/Free)
- `antivirus`, `antivirus_year`, `installed_apps`, `licensed_count`
- `notes`
- RLS: doar Super Admin

**Tabel `equipment_pin_settings`:**
- `id`, `global_pin_hash`, `max_attempts`, `lockout_minutes`

#### 2. Import CSV/XLS (2 fișiere noi)

- `src/utils/parseInventoryXls.ts` — parser pentru ambele sheet-uri folosind xlsx library
- `src/components/inventory/InventoryImport.tsx` — UI cu upload, preview, validare, import în masă
- Legătura între sheet-uri se face prin `Nr. inventar` (inventory_number)

#### 3. Profil individual echipament + QR

- `src/pages/InventoryProfile.tsx` — pagină completă per echipament cu:
  - Info fizic (clădire/etaj/cameră/brand/serie)
  - Software instalat (tab sau secțiune separată)
  - Istoric operații (din equipment_history existent)
- `src/components/inventory/EquipmentQRCode.tsx` — generare QR cu `qrcode.react`, buton print
- `src/pages/InventoryPublicView.tsx` — pagina accesibilă prin scanare QR

#### 4. Securizare PIN pentru pagina publică QR

- `src/components/inventory/PinGate.tsx` — input PIN 4-6 cifre, blocare după 3 încercări
- Edge function `verify-inventory-pin` — validare server-side cu bcrypt, rate limiting
- Super Admin accesează fără PIN (autentificat)

#### 5. Pagina principală Inventar

- `src/pages/Inventory.tsx` — dashboard cu:
  - Statistici (total, per tip, per clădire/etaj)
  - Filtrare/căutare avansată
  - Tabel cu toate echipamentele
  - Buton import XLS
  - Link QR per rând
- Rută nouă în `App.tsx`: `/inventory`
- Link în Sidebar sub secțiunea Admin

#### 6. Actualizare categorii

Extindere categorii pentru `Tip echipament`: laptop, pc, monitor, imprimantă, telefon, card_acces, cheie, altele — conform datelor din fișier.

### Securitate
- RLS pe toate tabelele noi — doar `super_admin`
- PIN hash-uit cu bcrypt (nu plain text)
- Edge function cu rate limiting pentru verificare PIN
- Pagina publică QR arată doar info minimale (denumire, serie, status, locație)

### Ordinea implementării
1. Migrări baza de date (tabele + coloane noi)
2. Parser XLS + import UI
3. Pagina Inventar + profil individual
4. QR code + PIN gate + edge function
5. Integrare în navigație

