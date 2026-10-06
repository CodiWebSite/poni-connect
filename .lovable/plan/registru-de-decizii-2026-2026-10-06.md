# Registru de Decizii 2026

## Ce am găsit în fișier
- 12 foi (ian–dec), antet: Academia Română / ICMPP / SRUS, titlu „OPIS DECIZII 2026", „Luna: ...".
- Coloane: **Nr.** (numerotare continuă pe tot anul, ex. ian 1–33 … sept 484+), **Denumire act**, **Data**, **Obs.** (sursa de finanțare: Buget, IntelDots, fonduri proprii…), **Inițiale întocmitor** (LN, DT, BC, CB etc.).
- **488 decizii** completate: ian 33, feb 31, mar 55, apr 67, mai 38, iun 150, iul 44, aug 41, sept 22, oct 5, nov 1, dec 1. Le import pe toate, exact cum sunt.

## Ce primești
1. **Pagina nouă „Registru Decizii"** în meniu (vizibilă doar celor cu acces).
   - Taburi pe luni (Ian … Dec) + selector de an.
   - Tabel identic cu Excelul: Nr. / Denumire act / Data / Obs. / Întocmit.
   - Căutare după nume/denumire, filtru după sursa de finanțare și întocmitor.
2. **Adăugare decizie nouă** — numărul se dă automat (următorul din an, fără dubluri), data implicit azi, luna se alege după dată.
3. **Editare / anulare** decizie — cu motiv obligatoriu, totul trecut în jurnalul de audit. Nu se șterge nimic definitiv, ca numerotarea să rămână corectă.
4. **Export Excel** — un fișier cu 12 foi (ian–dec), cu același antet, titlu „OPIS DECIZII 2026", „Luna:" și aceleași coloane ca acum. Plus export doar pentru luna curentă.
5. **Acces strict** — doar: Codrin Condrea, Dragoș Tofan, Narcis Pricop, Loredana Negru, Cătălina Balan (+ super-admin). Ceilalți nu văd pagina și nu pot citi datele nici direct din sistem. Lista de acces se poate modifica din Administrare → Roluri & Acces → „Registru Decizii".
6. Export și editare cer confirmarea parolei (ca la celelalte acțiuni sensibile).

## Detalii tehnice
- Tabel `decision_registry` (year, number, title, decision_date, month, funding_source, author_initials, status active/anulată, cancel_reason, created_by, timestamps), unic pe (year, number); trigger pentru numerotare automată și luna derivată din dată.
- Tabel `decision_registry_access` (user_id) + funcție `can_access_decision_registry(uid)` SECURITY DEFINER (super_admin sau în listă). RLS pe ambele; GRANT doar la authenticated/service_role, nimic pentru anon.
- Import unic al celor 488 de rânduri din XLSX (valorile calculate ale formulelor de numerotare).
- Export cu ExcelJS în browser, reproducând antetul și celula îmbinată A5:E5.
- Ruta `/registru-decizii` lazy, protejată prin funcția de acces; intrare în Sidebar condiționată.
- Test pentru regula de acces și pentru numerotarea automată.

## De confirmat
- Cele 4 persoane au deja cont; le găsesc după e-mail și le dau acces.
