# Audit platformă intranet — probleme identificate și îmbunătățiri propuse

Am verificat codul, configurarea și baza de date. Nu există erori de build sau erori runtime raportate în acest moment — platforma este funcțională. Problemele de mai jos sunt de robustețe, performanță și securitate.

## 1. Ecran alb la orice eroare de randare (prioritate maximă)

Nu există niciun ErrovBoundary în aplicație (verificat: zero apariții în `src/`). O singură eroare JavaScript într-un singur card (ex. o dată invalidă, un câmp lipsă din baza de date) face ca **toată pagina să devină albă**, fără mesaj. Acesta este exact simptomul semnalat de mai multe ori („imagine albă, nu apare nimic").

Propunere:
- `ErrorBoundary` global în `App.tsx` cu ecran de eroare prietenos (buton „Reîncarcă", „Înapoi la Dashboard") și logare automată a erorii.
- `ErrorBoundary` local pe widget-urile de Dashboard și pe modulele grele (Salarizare, Social, Chat), astfel încât un modul căzut să nu ia pagina cu el.

## 2. Toată aplicația se încarcă într-un singur pachet

`App.tsx` importă direct toate cele ~60 de pagini (66 de importuri, zero `React.lazy`). Un utilizator care intră doar pe Dashboard descarcă și Salarizarea, Medicina Muncii, Biblioteca, Chat-ul, Kiosk-ul etc. Pe conexiuni lente / mobil, prima încărcare este vizibil întârziată.

Propunere:
- `React.lazy` + `Suspense` pentru toate rutele, cu un skeleton de încărcare.
- Separarea manuală a librăriilor grele în chunk-uri proprii (PDF, Excel, editor de text) ca să nu intre în pachetul principal.

## 3. Cache-ul de date nu este configurat

`new QueryClient()` este folosit fără opțiuni. Practic fiecare navigare între pagini reinterogează baza de date, iar același utilizator/profil este cerut de zeci de ori pe sesiune.

Propunere: configurare `staleTime`, `gcTime`, `retry` și dezactivarea refetch-ului la fiecare focus de fereastră. Efect direct: mai puține cereri către backend (deci și mai puține credite consumate) și interfață mai rapidă.

## 4. Interogări care aduc coloane inutile

Există 85 de interogări `select('*')`, inclusiv pe tabele „grele" precum `employee_personal_data` (35 coloane, date sensibile) și `leave_requests` (32 coloane). Aduce trafic inutil și expune mai multe date decât e nevoie în client.

Propunere: înlocuirea treptată, începând cu tabelele cu date personale și cu listele lungi (HR, concedii, salarizare).

## 5. Securitate — funcții cu privilegii apelabile public

Linterul bazei de date semnalează 144 de avertismente, toate de același tip: funcții `SECURITY DEFINER` care pot fi apelate direct prin API de utilizatori anonimi (69) sau autentificați (75). Multe sunt funcții interne (triggere, funcții de notificare, funcții auxiliare pentru RLS) care nu ar trebui să fie apelabile din exterior.

Propunere: revocarea dreptului de execuție de la `anon`/`authenticated` pentru funcțiile interne (triggere, `notify_*`, `audit_*`, `social_*_trg`), păstrând accesul doar pentru funcțiile chemate intenționat din aplicație.

## 6. Igienă de cod

- 92 de fișiere folosesc `: any`, ceea ce ascunde erori reale la compilare (ex. tipul `related_id` care a produs deja un bug în Social).
- Fișiere foarte mari, greu de întreținut: `MedicinaMuncii.tsx` (1366 linii), `PostFeed.tsx` (1191), `MyProfile.tsx` (1155), `SystemStatus.tsx` (1020).
- 44 de fișiere conțin culori hardcodate (`text-white`, `bg-black`, hex), ceea ce sparge tema și modul întunecat în acele zone.

Propunere: refactorizare punctuală, doar unde aduce valoare (spargerea celor 4 fișiere mari în componente și înlocuirea culorilor hardcodate cu token-uri).

## Ordinea recomandată

1. ErrorBoundary global + local (elimină ecranele albe)
2. Lazy loading rute + chunk-uri (viteză)
3. Configurare cache react-query (viteză + credite)
4. Hardening funcții baze de date (securitate)
5. Curățare `select('*')` pe modulele cu date personale
6. Refactorizări de cod și token-uri de culoare

Spune-mi de unde vrei să începem — recomand punctele 1-3, care se pot livra împreună și au impactul cel mai vizibil pentru utilizatori.
