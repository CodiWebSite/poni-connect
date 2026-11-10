# Pagina de conectare – aspect nou 2026–2027

Rămân la fel: culorile ICMPP, sigla, conectarea cu e-mail + parolă, verificarea Cloudflare, codul 2FA, crearea contului. Se schimbă doar aspectul.

## Ce se vede
1. **Fundal viu, discret**: molecule (rețea de puncte și legături) care plutesc încet și reacționează ușor la mișcarea mouse-ului; pe telefon stau aproape nemișcate, ca să nu consume bateria.
2. **Lumini colorate în mișcare** (indigo/albastru ICMPP) în spatele formularului, foarte lente.
3. **Card din sticlă mată** pentru formular, cu margine luminoasă subtilă care se rotește.
4. **Câmpuri moderne**: eticheta urcă deasupra când scrieți, contur luminos la selectare, buton „Conectare" cu strălucire și stare de încărcare animată.
5. **Salut după ora României**: „Bună dimineața / Bună ziua / Bună seara" + data și ora live.
6. **Codul 2FA în 6 căsuțe separate**, cu trecere automată la următoarea și lipire din clipboard.
7. **Animație de succes** scurtă (bifă) înainte de intrarea în platformă; la eroare, cardul „tremură" ușor.
8. **Mod întunecat** automat după setarea calculatorului.
9. **Accesibilitate**: dacă cineva are „reducere mișcare" activată, efectele se opresc.

## Ce nu se schimbă
Securitatea, regulile de acces, deconectarea automată, verificarea Cloudflare.

## Detalii tehnice
- Doar `src/pages/Auth.tsx` + componente noi `src/components/auth/` (MoleculeField canvas cu rAF, pauză la tab ascuns, `prefers-reduced-motion`; OtpBoxes pe input-otp existent).
- Culori doar din tokeni din `src/index.css` (adăugare `--auth-glow`, gradient, umbre).
- Fără biblioteci noi; animații CSS + canvas. Verificare Playwright pe desktop și mobil.
