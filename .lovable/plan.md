# Refresh vizual major — Intranet ICMPP

Scop: o identitate vizuală mai matură și mai „instituțional-premium”, densitate mai bună a informației și consistență între module. Zero schimbări de logică de business (HR, concedii, salarizare rămân neatinse funcțional).

## 1. Sistemul de design (fundația)

Astăzi paleta e albastru rece + accent teal, font Inter + Playfair Display, radius 0.75rem, umbre stratificate și tokenuri de glass/gradient deja definite în `index.css`.

Ce schimb:
- **Tipografie**: înlocuiesc Inter/Playfair cu o pereche mai distinctă și mai lizibilă la densitate mare — titluri cu un display grotesk, corp cu un sans neutru optimizat pentru ecran. Scală tipografică explicită (display / h1–h4 / body / caption / mono pentru cifre).
- **Cifre tabelare**: `font-variant-numeric: tabular-nums` global pe tabele, solduri, statistici — coloanele de zile/sume nu mai „dansează”.
- **Paletă**: păstrez albastrul instituțional ca primar, dar recalibrez suprafețele (background mai cald/neutru, carduri cu separare clară), reduc gradientele decorative și le rezerv doar pentru elementele „hero”. Accentul teal devine strict semantic (succes/activ), nu decorativ.
- **Umbre & borduri**: trec pe o ierarhie de 3 niveluri (flat / raised / overlay) în loc de umbre multiple aplicate inconsistent.
- **Radius**: scădere ușoară pentru un aer mai „enterprise”, cu radius mai mare doar pe carduri mari.
- **Dark mode**: recalibrare completă a contrastelor (în prezent tema dark e derivată, nu proiectată) — verificare WCAG AA pe text, badge-uri și grafice.
- **Densitate**: introduc o clasă de densitate compactă pentru tabele și liste (HR, salarizare, arhivă) — mai multe rânduri pe ecran, fără să pară înghesuit.

## 2. Header și navigație

- Header redesenat: titlu + breadcrumb pe un singur rând coerent, grupare vizuală a acțiunilor (căutare / temă / hub / notificări / avatar) cu separatoare consistente și dimensiuni uniforme ale butoanelor.
- Căutarea globală devine element vizibil (câmp cu shortcut `Ctrl/⌘ K` afișat), nu doar iconiță.
- Bara de „MOD DEMO” refăcută cu tokeni semantici (acum folosește culori hardcodate amber), aliniată vizual cu restul sistemului.
- Sidebar: ierarhie mai clară a grupurilor, stare activă mai evidentă, badge-uri de notificări aliniate, tranziție curată la colapsare (rămâne mini-variant cu iconițe).
- Meniu mobil: aceleași grupuri ca desktop, ținte de atingere ≥44px, secțiuni colapsabile.

## 3. Dashboard-uri (cea mai vizibilă schimbare)

Există 6 dashboard-uri pe rol (`SuperAdmin`, `HRStaff`, `SefDepartment`, `MedicMuncii`, `OperationalRole`, `Employee`) și ~30 de widget-uri. Astăzi arată diferit între ele.

- **Grilă unificată de tip bento**: un rând de „stat cards” compacte sus, apoi zone mari (calendar/anunțuri) și coloană laterală de acțiuni rapide. Aceeași structură pentru toate rolurile, doar conținutul diferă.
- **StatCard redesenat**: valoare dominantă, delta față de perioada anterioară, sparkline discretă, iconiță subtilă — un singur component folosit peste tot.
- **Salut personalizat** compact, integrat în primul rând (nu bandă separată).
- **Bannere** (alerte, MFA, instalare app) unificate într-un singur slot cu priorități, ca să nu se stivuiască 3 bannere unul sub altul.
- **Skeletons** consistente pentru toate widget-urile (evită saltul de layout la încărcare).
- **Stări goale** desenate (ilustrație simplă + mesaj + acțiune), în loc de text gol.

## 4. Componente recurente

- **Tabele**: header sticky, zebra subtilă, sortare vizibilă, acțiuni la hover, paginare consistentă; pe mobil se transformă în carduri în loc de scroll orizontal.
- **Formulare**: etichete, spațiere, erori și texte ajutătoare standardizate (HR, cerere concediu, salarizare arată azi diferit).
- **Badge-uri de status**: un set unic de variante (aprobat / în așteptare / respins / anulat / distribuit), folosit în toate modulele.
- **Dialoguri și panouri**: dimensiuni și padding standard, header/footer fixe cu conținut scrollabil.
- **Micro-animații**: fade/scale discrete la montare, tranziții pe hover, respectând `prefers-reduced-motion`.

## 5. Social Hub

- Feed cu ierarhie tipografică mai clară, carduri de postare mai aerisite, acțiuni (reacții/comentarii/salvare) grupate într-o bară consistentă.
- Composer cu toolbar aliniat noului sistem.
- Profil comunitate cu header vizual (cover + avatar + membri).

## Detalii tehnice

- Toate valorile noi intră ca tokeni HSL în `index.css` + `tailwind.config.ts`; niciun `text-white` / `bg-[#...]` în componente.
- Refactorizare pe variante shadcn (`cva`) pentru `StatCard`, badge-uri de status, tabele — nu clase ad-hoc.
- Fonturile se încarcă cu `display=swap` și preconnect.
- Fără modificări de schemă, RLS, Edge Functions sau logică de calcul (concedii/FIFO/fluturași).
- Verificare finală pe desktop, tabletă și mobil, în light și dark, cu capturi înainte/după.

## Ordinea livrării

1. Tokeni + tipografie + dark mode (fundația).
2. Header, sidebar, meniu mobil.
3. StatCard + grila bento + cele 6 dashboard-uri.
4. Tabele, formulare, badge-uri, dialoguri.
5. Social Hub.

Pot livra etapizat, ca să validezi după fiecare pas înainte să merg mai departe.
