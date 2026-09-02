# Redesign pagina de autentificare — direcția „Neo-instituțional”

Rescriu vizual `/auth` în registrul modern 2026-2027 din varianta aleasă, păstrând intactă toată logica existentă (Turnstile, 2FA, recuperare parolă, formulare de asistență, deblocare biometrică).

## Ce se schimbă vizual

**Panoul stânga (brand)**
- Lățime 5/12, fundal albastru instituțional profund cu rețeaua moleculară existentă la opacitate redusă, animată foarte lent („respiră”).
- Logo ICMPP într-un pătrat de sticlă (blur + bordură subtilă), deasupra „ACADEMIA ROMÂNĂ / ICMPP «Petru Poni»” cu tracking larg.
- Titlu mare pe două rânduri, al doilea rând în albastru deschis, plus o frază de context.
- Cele 3 puncte de încredere (2FA obligatorie, RGPD, acces doar `@icmpp.ro`) trec în format titlu + subtitlu explicativ, ancorate jos în panou.

**Panoul dreapta (autentificare)**
- Dispare cardul cu bordură; formularul „respiră” direct pe fundal deschis, coloană centrată de max ~28rem.
- Tab-uri Autentificare/Înregistrare ca segmented control rotunjit, cu pastilă activă și tranziție lină.
- Etichete mici, majuscule, cu tracking larg; câmpuri mai înalte (ținte de atingere ≥44px), colțuri rotunjite generos, inel de focus vizibil.
- „Ai uitat parola?” urcă pe linia etichetei Parolă; toggle-ul de vizibilitate rămâne în câmp.
- Buton principal lat, plin, cu ridicare subtilă la hover și apăsare la click.
- Blocul „Asistență IT instituțională” devine un card mai aerisit, cu iconiță în pătrat colorat.
- Footer legal separat printr-o linie fină, text mic în majuscule; se păstrează textele RGPD și linkurile existente.

**Mobil**
- Panoul de brand se ascunde sub `lg` și e înlocuit de un antet compact cu logo + nume institut; formularul ocupă toată lățimea cu spațiere adaptată.

## Detalii tehnice

- Se editează doar `src/pages/Auth.tsx` (prezentare) și, la nevoie, `src/components/auth/MolecularPattern.tsx` pentru opacitate/animație.
- Toate culorile prin tokenuri semantice din `index.css` (fără `bg-[#003366]`, `text-white` hardcodat). Dacă lipsește o nuanță de albastru instituțional, o adaug ca token nou (`--brand`, `--brand-foreground`, `--brand-soft`) în `index.css` + `tailwind.config.ts`, funcțional în light și dark.
- Se păstrează componentele shadcn existente (Tabs, Input, Label, Button) cu stiluri suprascrise prin clase, ca să nu se piardă accesibilitatea și comportamentul.
- Neatinse: `handleLogin`/`handleSignup`, validările zod, verificarea Turnstile, fluxul de reset parolă, `AccountHelpForm`, `HelpdeskContactForm`, `BiometricUnlockButton`, redirecturile după login.
- Verificare finală: captură Playwright pe desktop 1440 și mobil 390, în light și dark, plus confirmare build fără erori.
