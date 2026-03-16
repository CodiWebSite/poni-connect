

## Fișă de Aptitudine — Generare PDF cu 3 exemplare pe o pagină

### Ce am înțeles

Din modelul scanat, fișa de aptitudine conține:
- **Antet**: Unitatea medicală, cabinet, adresă, telefon/fax
- **Tip control**: Angajare / Control periodic / Adaptare / Reluare a muncii / Supraveghere specială / Altele (checkbox-uri)
- **Titlu**: "Medicina muncii - FIȘĂ DE APTITUDINE nr. .../..."
- **Date societate**: Societatea, Adresa, Telefon/Fax
- **Date angajat**: Nume, Prenume, CNP, Ocupație/funcție, Post și loc de muncă
- **Aviz medical**: APT / APT CONDIȚIONAT / INAPT TEMPORAR / INAPT (cu checkbox + recomandări pe fiecare linie)
- **Subsol**: Data, Medic de medicina muncii (semnătură și parafă), Data următorului examen medical

Cele 3 exemplare trebuie să fie pe aceeași pagină A4, separate prin linii punctate orizontale (pentru a fi rupte/tăiate). Fiecare exemplar va fi identic, pre-completat cu datele angajatului din baza de date.

### Implementare tehnică

**Bibliotecă**: `jspdf` — trebuie instalată (nu există în proiect). Este ideală pentru layout precis pe A4 cu 3 secțiuni egale.

**Fișier nou**: `src/utils/generateFisaAptitudine.ts`
- Funcție `generateFisaAptitudine(params)` care primește datele angajatului, tipul controlului, avizul medical, recomandările, data, data următorului examen
- Desenează 3 copii identice ale fișei pe o pagină A4 (fiecare ~93mm înălțime), separate cu linie punctată
- Pre-completează câmpurile din datele medical_records + employee_personal_data
- Checkbox-urile se bifează automat în funcție de tipul consultației și avizul medical
- Salvează ca PDF

**Integrare în MedicinaMuncii.tsx**:
- Buton "Descarcă Fișă Aptitudine" în zona de detalii angajat (lângă butonul de upload documente)
- Disponibil doar când angajatul are fișă medicală cu aviz setat (nu pending)
- La click → generează PDF-ul și îl descarcă

### Structura fiecărui exemplar (~93mm pe A4)

```text
┌─────────────────────────────────────────────┐
│ Unitatea medicală: [config]                 │
│ Cabinet de medicina muncii                  │
│ Adresa: [config]  Telefon: [config]         │
│                                             │
│ [✓] Angajare [ ] Control periodic  etc.     │
│                                             │
│ FIȘĂ DE APTITUDINE nr. .../...              │
│ (Un exemplar la angajator, unul angajatului)│
│                                             │
│ Societatea: ICMPP  Adresa: ...              │
│                                             │
│ ┌─ Nume: BALAN  Prenume: CATALINA ────────┐ │
│ │  CNP: 123...  Ocupație: Cercetător      │ │
│ │  Post și locul de muncă: Lab. X         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ AVIZ MEDICAL:        Recomandări:           │
│ [✓] APT              ___________            │
│ [ ] APT CONDIȚIONAT   ___________           │
│ [ ] INAPT TEMPORAR    ___________           │
│ [ ] INAPT             ___________           │
│                                             │
│ Data: 16.03.2026    Medic: (semnătură)      │
│ Data următorului examen: ___________        │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│           (EXEMPLAR 2 - IDENTIC)            │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│           (EXEMPLAR 3 - IDENTIC)            │
└─────────────────────────────────────────────┘
```

### Pași de implementare

1. Instalez `jspdf` ca dependență
2. Creez `src/utils/generateFisaAptitudine.ts` cu funcția de generare PDF
3. Adaug în pagina MedicinaMuncii.tsx un buton "Descarcă Fișă Aptitudine" în secțiunea de detalii angajat
4. Datele se preiau automat din `employee_personal_data` (nume, CNP, funcție, departament) și `medical_records` (aviz, restricții, data validitate)

### Configurare instituțională

Datele cabinetului medical (adresă, telefon) și ale societății (ICMPP, adresă) vor fi hardcodate inițial — se pot muta ulterior într-un tabel de setări dacă e necesar.

