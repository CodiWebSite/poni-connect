

# Adaugare camp "Data expirare CI" in loc de calcul automat

## Problema
Calculul automat al expirarii CI pe baza CNP-ului si datei eliberarii nu este precis. Data reala de expirare este tiparita pe document si poate diferi de formula teoretica. Exemplu: Condrea Codrin-Ioan - calculul da 01.02.2034, dar data reala este 03.08.2031.

## Solutia
Inlocuirea logicii de calcul cu un camp dedicat `ci_expiry_date` in baza de date, completat manual de HR.

## Pasi de implementare

### 1. Migrare baza de date
- Adaugare coloana `ci_expiry_date` (tip `date`, nullable) in tabela `employee_personal_data`

### 2. Actualizare formular HR (PersonalDataEditor.tsx)
- Adaugare camp "Data expirare CI" langa campul "Data eliberarii CI"
- Salvare in noua coloana la submit

### 3. Actualizare HRAlerts.tsx
- Eliminarea functiei `getCIExpiryDate()` (calculul automat)
- Citirea directa a valorii din `ci_expiry_date`
- Alertele vor aparea doar pentru angajatii care au acest camp completat

### 4. Actualizare profil angajat (MyProfile.tsx)
- Afisarea datei de expirare CI in sectiunea de date de identitate

### 5. Actualizare import angajati (daca exista coloana in fisierul CSV)
- Verificare daca importul poate prelua si data de expirare

## Detalii tehnice
- Coloana noua: `ALTER TABLE employee_personal_data ADD COLUMN ci_expiry_date date;`
- Tipul `types.ts` se va regenera automat dupa migrare
- Alertele vor folosi comparatie simpla: `differenceInDays(ci_expiry_date, now)` fata de pragul de 90 zile
- Fisiere modificate: `HRAlerts.tsx`, `PersonalDataEditor.tsx`, `MyProfile.tsx`

