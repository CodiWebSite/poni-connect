

## Dosar Medical — Generare PDF multi-pagina

### Ce am identificat din fotografii

Dosarul medical este un document de ~6 pagini cu structura:

1. **Coperta**: Cabinet de Medicina Muncii (Unitatea, Adresa, Telefon), "DOSAR MEDICAL nr. ...", Numele și Prenumele, Societatea Comercială, Legitimația/Marca, CNP, Domiciliul
2. **Pagina legală**: Citat legislativ (OMMSS 508 / OMSF 933 / NGPM art.32), nota confidențialitate
3. **Pagina 1 (Anexa nr.4)**: Date personale (Nume, Prenume, Sex, Vârstă, Data nașterii, CNP, Adresa), Ocupația/Funcția, Formarea profesională, Ruta profesională, Tabel istoric locuri de muncă (Post, Perioadă, Ocupație, Noxe), Activități la actualul loc de muncă, Boli profesionale DA/NU
4. **Pagina 2**: Accidente de muncă DA/NU, Medic de familie, Declarația pe propria răspundere, Antecedente heredocolaterale, Antecedente personale fiziologice și patologice, Fumat/Alcool
5. **Pagina 3 (Examen medical la angajare)**: Examene clinice/paraclinice (Talie, Greutate, Obezitate), 11 sisteme (Tegumente, Țesut celular, Sistem ganglionar, Ap. locomotor, Ap. respirator, Ap. cardiovascular, Ap. digestiv, Ap. urogenital, SNC/analizatori, Sistem endocrin), Examene opționale (VDRL/RPA)
6. **Pagina 4**: Examene suplimentare, Concluzii examinare (sănătos/diagnostic), AVIZ MEDICAL (APT/APT CONDIȚIONAT/INAPT TEMPORAR/INAPT), Recomandări, Data, Medic, Data următorului examen
7. **Pagina 5 (Examen medical periodic)**: Simptome actuale, Reactualizare anamneză, Simptome la locul de muncă, Date biometrice, Examen clinic (aceleași 10 sisteme), TA/AV
8. **Pagina 6**: Continuare periodic (sisteme 8-10), Concluzii, AVIZ MEDICAL, Recomandări, Data următorului examen

### Ce putem implementa

Dosarul medical este un formular tipizat care se completează partial digital, partial manual (de medic la consultație). Abordarea realistă:

**A. Generare PDF "gol" pre-completat** — un dosar medical cu structura completă, pre-completat cu datele angajatului din baza de date (nume, CNP, funcție, departament, adresă, societate) dar cu câmpuri goale pentru examenul clinic (pe care medicul le completează de mână).

### Implementare tehnică

1. **Nou fișier**: `src/utils/generateDosarMedical.ts`
   - Funcție `generateDosarMedical(params)` care generează un PDF A4 multi-pagina cu `jsPDF`
   - 6 pagini cu layout-ul exact din fotografii
   - Pre-completează: Nume, Prenume, CNP, Sex (dedus din CNP), Vârstă, Data nașterii, Adresă, Societatea, Ocupația/Funcția, Departament
   - Câmpuri goale: tot ce ține de examenul clinic, antecedente, diagnostic
   - Folosește configurația din `MedicalSettingsPanel` (cabinet, adresă, medic)

2. **Tabel nou** (opțional, nu obligatoriu acum): `medical_dossier_data` pentru date suplimentare pe care medicul le completează digital (formarea profesională, ruta profesională, noxe, boli profesionale, accidente de muncă, antecedente, fumat/alcool). Acestea ar putea fi completate din UI și incluse automat în PDF.

3. **Integrare în `MedicinaMuncii.tsx`**: Buton "Descarcă Dosar Medical" pe fișa fiecărui angajat, lângă butonul existent de "Fișă Aptitudine".

4. **Date pre-completate automat**:
   - Din `employee_personal_data`: last_name, first_name, cnp, address_*, position, department
   - Din `MedicalSettingsPanel` config: unitate medicală, adresă cabinet, telefon, societate
   - Sex + data nașterii: deduse din CNP

### Pași concreți

1. Creez `src/utils/generateDosarMedical.ts` — PDF 6 pagini cu jsPDF
2. Creez tabel `medical_dossier_data` cu câmpuri completabile digital (formarea profesională, ruta profesională, istoric locuri de muncă ca JSONB, boli profesionale, accidente muncă, antecedente, fumat/alcool)
3. Adaug în pagina MedicinaMuncii buton "Dosar Medical" + dialog opțional pentru completare date suplimentare înainte de generare
4. PDF-ul se descarcă cu toate datele disponibile pre-completate, restul rămân goale pentru completare manuală

### Notă
Nu toate paginile din dosar vor fi 100% identice cu originalul tipizat (limitare jsPDF fără fonturi custom), dar structura, câmpurile și layout-ul vor fi fidele modelului.

