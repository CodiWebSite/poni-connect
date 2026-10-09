# Trecerea automată la anul 2027 – solduri concediu

## Regulile
1. **Report din 2025**: zilele rămase din 2025 se pot folosi până la **21 iunie 2027**. După această dată se anulează automat.
2. **Report din 2026**: zilele rămase la 31.12.2026 se trec automat ca report în 2027.
3. **Sold standard 2027**: **35 de zile pentru toată lumea**, cu posibilitatea ca HR să modifice soldul fiecărei persoane (mai multe sau mai puține zile).
4. **Ordinea consumului**: întâi se consumă reportul cel mai vechi (2025), apoi 2026, apoi soldul 2027.

## Ce se întâmplă pe 1 ianuarie 2027 (automat, 00:05)
- Pentru fiecare angajat activ se calculează ce i-a rămas din 2026 și se salvează ca report pentru 2027.
- Reportul rămas din 2025 se păstrează, cu termen-limită 21.06.2027.
- Soldul anual 2027 se setează la 35 de zile, iar zilele folosite pornesc de la 0.
- Excepțiile setate dinainte de HR sunt păstrate și nu se suprascriu.
- Totul se poate rula o singură dată; o a doua rulare nu dublează zilele.

## Ce vede HR
În Gestiune HR, o secțiune nouă **„Deschidere an 2027”**:
- **Previzualizare** înainte de 1 ianuarie: tabel cu fiecare angajat – report 2025, report 2026, sold 2027, total disponibil.
- **Editare sold 2027** pe persoană, cu motiv obligatoriu (salvat în istoric).
- Buton „Rulează acum” (cu reconfirmare parolă), în caz că vreți să o porniți manual.
- Raport după rulare: câți angajați au fost actualizați și eventuale probleme.

## Ce vede angajatul
În „Sold Concediu”: 
- Report 2025 – X zile (valabil până la 21.06.2027)
- Report 2026 – Y zile
- Sold 2027 – 35 zile
- **Total disponibil**

## Detalii tehnice
- Coloană nouă `expires_at` pe `leave_carryover` (2025→2027: 2027-06-21); reporturile expirate sunt ignorate în calcul și la depunere cereri.
- Tabel nou `leave_year_entitlements` (epd_id, an, zile, motiv, modificat de) pentru soldul anual editabil; implicit 35 pentru 2027.
- Funcție DB `open_leave_year(2027)` idempotentă + programare automată la 1 ianuarie; jurnal în audit.
- Actualizare calcul sold (`recalculate_leave_balance`, formularul de cerere, widget-ul personal, IRIS) pentru FIFO pe mai mulți ani și expirare.
- Teste pentru: 35 zile implicit, expirare 21.06.2027, ordinea FIFO, rulare dublă fără efect.

## De confirmat
- 35 de zile includ și zilele suplimentare (bonus/vechime) sau acestea se adaugă peste?
