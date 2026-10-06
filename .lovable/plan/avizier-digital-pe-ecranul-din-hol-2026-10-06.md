# Avizier digital pe ecranul din hol

## Ce construim

- După terminarea filmului de prezentare, ecranul trece automat în modul **Avizier**.
- Afișele sunt prezentate pagină cu pagină, la dimensiunea maximă posibilă, fără tăiere.
- Fiecare pagină rămâne vizibilă **60 de secunde**.
- După ultimul afiș, filmul institutului pornește din nou; rotația continuă permanent.
- Afișul „Zilele Academice Ieșene” primit acum va fi primul element al avizierului, cu toate cele 4 pagini în ordinea originală.

## Administrare

În **Administrare → Setări aplicație → Mod Kiosk / TV** va exista o zonă clară „Avizier digital” unde un super-admin poate:

- încărca poze JPG/PNG sau documente PDF;
- vedea miniaturile tuturor paginilor înainte de afișare;
- completa un titlu;
- alege o dată de expirare sau „Permanent”;
- activa/dezactiva temporar un afiș fără să-l șteargă;
- schimba ordinea afișelor;
- elimina un afiș și toate paginile lui.

PDF-urile vor fi transformate automat în imagini clare, câte una pentru fiecare pagină, astfel încât să funcționeze stabil și pe browserul televizorului Samsung.

## Comportament și siguranță

- Afișele expirate nu mai apar automat pe televizor, dar rămân vizibile în Administrare pentru gestionare.
- Dacă un afiș nu se poate încărca, kiosk-ul îl sare și continuă rotația, fără să rămână blocat.
- Lista se reîmprospătează periodic, astfel încât modificările din Administrare să ajungă pe televizor fără intervenții repetate.
- Muzica de fundal continuă în timpul avizierului; filmul și modul de repaus rămân neschimbate.
- Formatul vechi cu poze deja configurate rămâne compatibil.

## Detalii tehnice

- Datele avizierului vor fi păstrate într-o setare structurată, cu titlu, pagini, ordine, stare și expirare.
- Fișierele vor fi păstrate în spațiul media existent al kiosk-ului, cu acces public doar pentru afișare.
- Conversia PDF se face la încărcare, nu pe televizor, pentru compatibilitate și consum redus.
- Se adaugă validări pentru tipul și dimensiunea fișierelor și mesaje clare la încărcare.
- Se verifică rezultatul pe desktop și în dimensiunea ecranului TV, inclusiv rotația film → avizier → film.
