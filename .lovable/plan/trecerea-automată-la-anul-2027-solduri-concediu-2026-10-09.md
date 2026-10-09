# Trecerea automată la anul 2027 – solduri concediu

## Regulile
1. **Report din 2025**: termen orientativ **30 iunie 2027**. Nu se închide automat — rămâne activ până când HR îl închide manual (buton „Închide report 2025”, cu motiv și reconfirmare parolă). După 30.06.2027 HR vede doar un avertisment.
2. **Report din 2026**: zilele rămase la 31.12.2026 se trec automat ca report în 2027.
3. **Sold standard 2027**: **36 de zile pentru toți angajații**, fără legătură cu bonus sau vechime. Excepțiile și bonusurile (mai mult sau mai puțin) le setează HR manual, pe persoană.
4. **Ordinea consumului**: întâi reportul cel mai vechi (2025), apoi 2026, apoi soldul 2027.

## Ce se întâmplă pe 1 ianuarie 2027 (automat, 00:05)
- Pentru fiecare angajat activ se calculează ce i-a rămas din 2026 și se salvează ca report pentru 2027.
- Reportul rămas din 2025 se păstrează, activ până la închiderea manuală de HR.
- Soldul anual 2027 se setează la 36 de zile, iar zilele folosite pornesc de la 0.
- Excepțiile setate dinainte de HR sunt păstrate și nu se suprascriu.
- O a doua rulare nu dublează zilele.

## Ce vede HR
În Gestiune HR, secțiune nouă **„Deschidere an 2027”**:
- **Previzualizare** înainte de 1 ianuarie: fiecare angajat – report 2025, report 2026, sold 2027, total disponibil.
- **Editare sold 2027** pe persoană, cu motiv obligatoriu (salvat în istoric).
- Buton „Rulează acum” (cu reconfirmare parolă), pentru pornire manuală.
- Buton „Închide report 2025” – folosit doar când decide HR.
- Raport după rulare: câți angajați au fost actualizați și eventuale probleme.

## Ce vede angajatul
În „Sold Concediu”:
- Report 2025 – X zile (termen orientativ 30.06.2027)
- Report 2026 – Y zile
- Sold 2027 – 36 zile
- **Total disponibil**

## Detalii tehnice
- Pe `leave_carryover`: `expires_at` (informativ, 2027-06-30 pentru 2025→2027) și `closed_at` / `closed_by` / `close_reason`; doar reporturile închise manual sunt ignorate în calcul.
- Tabel nou `leave_year_entitlements` (epd_id, an, zile, motiv, modificat de); implicit 36 pentru 2027.
- Funcție DB `open_leave_year(2027)` idempotentă + programare automată la 1 ianuarie; jurnal în audit.
- Actualizare calcul sold (`recalculate_leave_balance`, formular cerere, widget personal, IRIS) pentru FIFO pe mai mulți ani și închidere manuală.
- Teste: 36 zile implicit, report 2025 activ după 30.06.2027 până la închiderea manuală, ordinea FIFO, rulare dublă fără efect.
