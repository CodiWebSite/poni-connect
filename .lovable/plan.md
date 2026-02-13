
# Plan: Modul Biblioteca cu rol BIBLIOTECAR

## Rezumat
Se creaza un modul complet de biblioteca cu rol dedicat `bibliotecar`, doua tabele (carti si reviste), pagina cu doua tab-uri, posibilitate de imprumut catre angajati si export Excel.

---

## 1. Baza de date - Migrari SQL

### 1.1 Adaugare rol `bibliotecar` in enum-ul `app_role`
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bibliotecar';
```

### 1.2 Tabel `library_books` (Carti)
Coloane: id, cota, inventar, titlu, autor, location_status (depozit/imprumutat), borrowed_by (referinta la profiles.user_id), borrowed_at, returned_at, created_at, updated_at.

### 1.3 Tabel `library_magazines` (Reviste)
Coloane: id, titlu, an, volum, numar, location_status, borrowed_by, borrowed_at, returned_at, created_at, updated_at.

### 1.4 Politici RLS
- SELECT/INSERT/UPDATE/DELETE permise doar utilizatorilor cu rol `bibliotecar` sau `super_admin` (folosind functia `has_role` existenta).

### 1.5 Functie helper
```sql
CREATE FUNCTION can_manage_library(_user_id uuid) ...
-- verifica daca rolul e bibliotecar sau super_admin
```

---

## 2. Frontend - Hook useUserRole

Se adauga:
- `bibliotecar` in tipul `AppRole`
- `isBibliotecar` flag
- `canManageLibrary` flag (bibliotecar sau super_admin)

---

## 3. Frontend - Pagina Biblioteca

### Fisier nou: `src/pages/Library.tsx`
- Doua tab-uri: **Carti** si **Reviste**
- Fiecare tab are un tabel cu coloanele cerute
- Buton "Adauga carte" / "Adauga revista" care deschide un dialog cu formular
- Coloana "Locatie actuala" afiseaza "Depozit" sau numele angajatului
- Buton "Imprumuta" pe fiecare rand - deschide un select cu angajatii din profiles
- Buton "Returneaza" cand e imprumutat
- Buton "Export Excel" care genereaza un fisier .xlsx cu toate datele (carti sau reviste, incluzand cine a imprumutat si cand)

---

## 4. Navigare

### Sidebar.tsx
- Se adauga item "Biblioteca" (icon: `BookOpen`) vizibil doar pentru `isBibliotecar` sau `isSuperAdmin`

### App.tsx
- Ruta noua: `/library` -> componenta `Library`

### handle_new_user (trigger existent)
- Rolul `bibliotecar` va fi automat mapat la label "Bibliotecar" in notificarea de bun-venit (se actualizeaza functia)

---

## 5. Export Excel

Se foloseste biblioteca `exceljs` (deja instalata) pentru a genera:
- **Raport Carti**: toate cartile cu cota, inventar, titlu, autor, locatie, imprumutat la, data imprumut
- **Raport Reviste**: toate revistele cu titlu, an, volum, numar, locatie, imprumutat la, data imprumut

---

## Fisiere modificate
- `src/hooks/useUserRole.tsx` - adaugare `bibliotecar`
- `src/components/layout/Sidebar.tsx` - link Biblioteca
- `src/App.tsx` - ruta `/library`

## Fisiere noi
- `src/pages/Library.tsx` - pagina principala cu tab-uri, CRUD, imprumut si export

## Migrari baza de date
- Adaugare valoare enum `bibliotecar`
- Creare tabele `library_books` si `library_magazines`
- RLS policies
- Functie `can_manage_library`
- Update trigger `handle_new_user` pentru label bibliotecar
