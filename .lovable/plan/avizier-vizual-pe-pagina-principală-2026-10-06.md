# Avizier vizual pe pagina principală

## Ce construim
- Adăugăm o bandă „Avizier” pe pagina principală, vizibilă tuturor angajaților, indiferent de rol.
- Folosim automat aceleași afișe, aceeași ordine, stare și dată de expirare ca pe televizor.
- Afișele expirate sau dezactivate nu apar.

## Experiență
- Banda apare imediat după mesajele importante și înaintea rezumatului personal.
- Pe desktop afișele sunt prezentate într-un șir orizontal; pe telefon se derulează natural cu degetul și se fixează pe fiecare afiș.
- Fiecare afiș arată prima pagină, titlul și numărul de pagini.
- Apăsarea deschide afișul într-o fereastră mare, cu navigare între toate paginile, zoom lizibil și descărcarea imaginii curente.
- Dacă există un singur afiș, păstrăm prezentarea aerisită; dacă nu există afișe active, banda nu ocupă spațiu.

## Administrare și verificare
- Nu adăugăm o administrare separată: modificările din „Administrare → Setări aplicație → Mod Kiosk / TV → Avizier digital” se reflectă și pe pagina principală.
- Verificăm afișarea pe desktop și telefon, deschiderea tuturor paginilor și ascunderea automată după expirare.

## Detalii tehnice
- Componentă comună nouă inclusă în `DashboardBanners`, astfel încât toate variantele paginii principale să o primească.
- Datele sunt citite din setarea publică `kiosk_bulletins`; filtrarea expirării se face la afișare și se reîmprospătează periodic.
- Se folosesc componentele și culorile existente ale platformei, fără tabele sau permisiuni noi.
