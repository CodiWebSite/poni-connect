# Programări vizite ICMPP

## Ce primiți
O pagină nouă **„Programări vizite"** în meniul intranetului (desktop și telefon), vizibilă doar pentru: super-admini, dna director Valeria Harabagiu, Petrișor Samoilă, Mihaela Dascălu și Mirela Fernanda Zaltariov.

## Cum arată (modern și instituțional)
- **Sus: 4 cifre rapide** — vizite luna aceasta, total elevi/studenți, vizite în așteptarea aprobării, următoarea vizită (cu numărătoare: „peste 3 zile").
- **Comutator de vedere:**
  - **Tabel pe luni** — exact coloanele din Excel (Data, Ora, Unitatea de învățământ, Nr. solicitare, Aprobare / Nr. înregistrare ICMPP, Nr. elevi/studenți, Clasa, Cadre didactice), grupat „Luna octombrie 2026", „Luna noiembrie 2026" etc. **Orice căsuță se editează direct prin clic**, se salvează automat.
  - **Calendar** — fiecare vizită pe zi, colorată după stare.
- **Stare aprobare vizibilă ca etichetă colorată:** Aprobată (are nr. înregistrare), În semnare („cerere dată la semnat"), Intenție transmisă, Anulată — detectată automat din textul coloanei, dar modificabilă.
- **Avertizare** când în aceeași zi sunt mai multe grupuri apropiate ca oră (ex. 21 octombrie: 9:00, 10:00, 12:00).
- Buton **„Adaugă vizită"**, căutare după școală, filtru pe lună/stare.
- **Export Excel** cu același aspect ca tabelul original.
- **Istoric modificări** — cine a schimbat ce și când.
- Vizitele nu se șterg definitiv, doar se marchează „Anulată".

## Date inițiale
Încarc exact cele 6 vizite din Excel (5 în octombrie, 1 în noiembrie), cu textele neschimbate.

## Opțional (spuneți dacă le vreți)
- Vizita zilei să apară pe ecranul din hol („Bine ați venit, Școala …").
- Notificare către cei 5 cu o zi înainte de vizită.

## Detalii tehnice
- Tabel `school_visits` (visit_date, visit_time, institution, request_no, approval_no, participants, class_level, teachers, status, notes, month_label, cancelled_at) + `school_visits_access` (user_id) + funcție `can_access_school_visits` (super_admin sau listat), RLS pe toate operațiile; audit în `audit_logs`.
- Administrare → Roluri & Acces: listă editabilă a persoanelor cu acces (ca la Registrul de Decizii).
- Pagină `/programari-vizite`, intrare în Sidebar și MobileNav, gardă pe rută; export cu exceljs.
