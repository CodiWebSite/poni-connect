
# Imbunatatiri Sistem Concedii HR

## Obiectiv
Doua imbunatatiri principale: (1) simplificarea procesului de inregistrare manuala a concediilor in Gestiune HR si (2) afisarea istoricului concediilor in profilul angajatului.

---

## Partea 1: Acces rapid la inregistrare concediu din lista angajatilor

**Problema actuala:** HR trebuie sa apese butonul "Concediu Manual" din bara de sus, apoi sa caute angajatul intr-un dropdown cu toti angajatii. Acest proces este incomod cand HR vrea sa inregistreze concediul pentru un angajat specific pe care il are deja in fata.

**Solutia:** Adaugam un buton "Concediu" direct pe fiecare card de angajat din lista, langa butoanele existente ("Editeaza", "Incarca Doc.", "Cereri"). Cand HR apasa pe acest buton, dialogul de concediu manual se deschide cu angajatul deja preselectat.

### Ce se schimba in fisierul `src/pages/HRManagement.tsx`

**1. Buton nou pe fiecare angajat (zona liniilor 745-780)**
- Se adauga un buton "Concediu" cu iconita Calendar
- Butonul apare doar daca angajatul are date de angajare (employee record) configurate
- La click, seteaza `manualLeaveForm.employee_id` cu user_id-ul angajatului si deschide dialogul

**2. Cautare rapida in dialogul de concediu manual**
- In dropdown-ul de selectie angajat, adaugam un camp de cautare (filter) pentru a gasi rapid angajatul dupa nume
- Afisam departamentul angajatului langa nume pentru identificare mai usoara

**3. Calcul automat vizibil**
- Cand HR selecteaza perioada, se afiseaza clar: numar zile lucratoare, sold curent, sold dupa inregistrare
- Mesaj de atentionare vizibil daca zilele solicitate depasesc soldul disponibil

---

## Partea 2: Istoric concedii vizibil pentru angajat

**Solutia:** In pagina "Profilul Meu" (`src/pages/MyProfile.tsx`), adaugam un card nou intre soldul de concediu si sectiunea "Date de Identificare" care afiseaza lista tuturor concediilor inregistrate.

### Ce se schimba in fisierul `src/pages/MyProfile.tsx`

**1. Adaugare state si query (zona fetchData, linia ~107)**
- Se adauga un state `leaveHistory` pentru lista de concedii
- In functia `fetchData()`, se adauga un query:
  - Tabela: `hr_requests`
  - Filtru: `user_id = user.id` si `request_type = 'concediu'`
  - Ordonare: `created_at` descrescator (cele mai recente primele)
- Nu sunt necesare modificari la baza de date sau politici RLS -- angajatii au deja acces la propriile cereri HR prin polita existenta "Users can view their own HR requests"

**2. Card nou "Istoricul Concediilor" (dupa linia 338)**
- Se insereaza intre cardul "Sold Zile Concediu" si sectiunea "Date de Identificare"
- Pentru fiecare concediu inregistrat se afiseaza:
  - Perioada: data inceput - data sfarsit (format: 15 Ianuarie - 22 Ianuarie 2026)
  - Numar de zile lucratoare
  - Status cu badge colorat: verde = Aprobat, galben = In asteptare, rosu = Respins
  - Data inregistrarii in sistem
  - Eticheta "Inregistrare manuala HR" daca campul `manualEntry` din details este `true`
- Daca nu exista concedii, se afiseaza un mesaj informativ

**3. Import iconita suplimentara**
- Se adauga `History` din lucide-react

---

## Detalii tehnice importante

- **Nu sunt necesare migrari SQL** -- toate datele exista deja in tabela `hr_requests`
- **Nu sunt necesare noi politici RLS** -- angajatii pot citi propriile cereri, HR poate citi toate cererile
- **Nu sunt necesare edge functions noi**
- **Fisiere modificate:** doar `src/pages/HRManagement.tsx` si `src/pages/MyProfile.tsx`
