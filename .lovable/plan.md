## Obiectiv

Reorganizez aplicația într-un sistem **HUB** cu două zone: **INTRANET CORE HR** (existent, curățat) și **INTRANET SOCIAL** (nou). Adaug un **app switcher** în colțul dreapta sus (iconița 4 pătrate, ca în screenshot). Iterația aceasta = **shell + reorganizare**, fără tabele noi.

Stil vizual urmărit (referință Papervee din screenshot-uri): fundal alb foarte curat, sidebar alb cu item activ pe `bg-primary/8 border border-primary/20 rounded-xl`, accent mov, tipografie airy, empty states centrate cu iconiță `i` într-un cerc, butoane primary mov pline.

## 1. App Switcher (HUB)

`src/components/layout/HubSwitcher.tsx`:
- Buton cu iconiță `LayoutGrid` (4 pătrate), plasat în Header lângă avatar.
- `Popover` shadcn → card alb, shadow elegant `shadow-lg`, lățime ~280px.
- Conține:
  - Header mic „Intranet ICMPP"
  - **Intranet Core HR** — iconiță `Briefcase`, accent mov când e activ
  - **Intranet Social** — iconiță `Users`, accent mov când e activ
  - Separator + buton secundar „Administrare cont" (link la `/account-security`)
- Hub-ul activ = derivat din `useLocation` (`/social/*` → Social, restul → Core HR).
- Click → navighează la `/` sau `/social`.
- Persistă ultima alegere în `localStorage` (`lastHub`) — la login pe `/`, redirect spre hub-ul preferat dacă există.
- Inserat în `src/components/layout/Header.tsx` lângă elementele existente (Vee search, notificări, avatar).

## 2. Sidebar dublu

Refactor `Sidebar.tsx` să accepte `variant: 'core' | 'social'`.

**Core HR** — rămâne tot ce există acum, **MAI PUȚIN** ce mut în Social:
- Rămân: Dashboard, Profilul Meu, Calendar Concedii, Formulare, Cerere Concediu, Echipa Mea, Bibliotecă, Programări Săli, Medicină Muncii, Cărți Vizită, Adeverințe SCTP, Mail ICMPP, Ghid, Instalează App, Securitatea contului, Idei & Feedback, secțiunea Management completă (Gestiune HR, Salarizare, Agenda întâlniri, Setări, Stare Sistem, Administrare, Inventar, Changelog).
- Ies din sidebar Core HR: Anunțuri, Activități Recreative, Mesagerie, Arhivă Online, Securitate Digitală (rutele rămân funcționale, doar nu mai apar în sidebar Core).

**SocialSidebar** nou (`src/components/layout/SocialSidebar.tsx`):
- Feed-ul tău → `/social`
- Comunități → `/social/comunitati`
- Anunțuri → `/social/anunturi` (reutilizează `Announcements.tsx`)
- Aniversări → `/social/aniversari`
- Colegi de muncă → `/social/colegi`
- Organigramă → `/social/organigrama`
- Activități Recreative → `/social/activitati` (reutilizează pagina)
- Mesagerie → `/social/chat` (reutilizează `Chat.tsx`)
- Arhivă Online → `/social/arhiva` (reutilizează)
- Securitate Digitală → `/social/securitate` (reutilizează)
- Setări → `/social/setari` (doar pentru admin/HR)

Mobil: `MobileNav` primește prop `variant` și randează lista corespunzătoare.

## 3. SocialLayout

`src/components/layout/SocialLayout.tsx`:
- Wrapper care randează `SocialSidebar` + `Header` (cu HubSwitcher) + `<Outlet />`
- Fundal `bg-background` (alb pur)
- Spațiere generoasă, card-uri `rounded-xl border bg-card shadow-sm`
- Item activ în sidebar: `bg-primary/8 text-primary border border-primary/20` (distinct de gradient-ul Core HR pentru a diferenția hub-urile vizual)

## 4. Pagini noi sub `src/pages/social/`

Toate respectă layout-ul vizual din screenshot-urile Papervee — content centrat, empty states cu cerc `i`, fără chrome inutilă.

| Pagina | Conținut |
|---|---|
| `Feed.tsx` | Layout 2 coloane (main + dreapta 320px). Main = card mare alb cu empty state „În acest moment nu există nicio noutate în feed-ul tău". Dreapta = card „Comunități" (listă cu IT — un singur item demo + chevron) și sub el „Evenimente viitoare" (empty card). |
| `Communities.tsx` | Tabs sus: „Comunități active / Comunități arhivate / Cereri". Search dreapta + buton mov „+ Creează comunitate" (dezactivat pentru non-admin/HR). Secțiunea „Comunitățile tale (1)" cu card-ul „IT" (badge Public, 0 postări 0 evenimente, 1 membru, buton mov „Vezi comunitatea"). Sub: „Alte comunități (0)" empty. |
| `CommunityDetail.tsx` | Rută `/social/comunitati/:slug`. Header: „← Înapoi la comunități". Stânga: titlu IT + tabs (Feed/Evenimente/Media) + buton mov „Postare nouă" (dezactivat) + empty state „În acest moment nu există nicio postare în comunitate". Dreapta: card „Despre" cu badge Public, contor postări/evenimente, „Membri (1)" + search + listă membri (Codrin admin) + butoane „Ieșire" / settings. |
| `Birthdays.tsx` | Două card-uri mari side-by-side: „🎉 Zile de naștere" și „🎉 Aniversări de muncă", subtitlu cu luna curentă. Vechimea = auto din `employee_personal_data.data_angajare` (luna curentă, doar zi+lună). Zilele de naștere = empty în această iterație + mesaj „Se pare că nu există zile de naștere luna aceasta" (opt-in introdus iterație viitoare). |
| `Colleagues.tsx` | Search bar mare central + buton „Ascunde toată compania". Tabel: NUME (sortabil ↑↓) + FUNCȚIE + chevron. Date din `employee_directory` view. Click pe rând → `/profil/:id`. |
| `OrgChart.tsx` | Toolbar sus stânga: `−` `+` `Zoom fix`. Dreapta: buton „⬇ Exportă" (dezactivat). Canvas alb cu un nod root „ICMPP — Organizație" și sub el utilizatorul curent (auto din profiles). Versiunea inițială folosește un arbore simplu CSS/SVG, fără react-flow — implementare full în iterație viitoare. |
| `SocialSettings.tsx` | Header „Papervee Social" cu subtitlu. Grid 4 card-uri: „Permisiune generală de adăugare a anunțurilor", „Calendar public de concedii", „Calendar public de telemuncă", „Calendar public program de lucru" — fiecare cu toggle (UI only). Rând 2: card „Permisiuni utilizatori în Papervee Social" cu link „Gestionează permisiuni". Toggle-urile arată toast „Va fi salvat în iterația următoare". Doar admin/HR. |

## 5. Rute (App.tsx)

Adaug grup nou:
```text
<Route path="/social" element={<ProtectedRoute><SocialLayout /></ProtectedRoute>}>
  <Route index element={<Feed />} />
  <Route path="comunitati" element={<Communities />} />
  <Route path="comunitati/:slug" element={<CommunityDetail />} />
  <Route path="anunturi" element={<Announcements />} />
  <Route path="aniversari" element={<Birthdays />} />
  <Route path="colegi" element={<Colleagues />} />
  <Route path="organigrama" element={<OrgChart />} />
  <Route path="activitati" element={<Activities />} />
  <Route path="chat" element={<Chat />} />
  <Route path="arhiva" element={<Archive />} />
  <Route path="securitate" element={<SecurityQuiz />} />
  <Route path="setari" element={<SocialSettings />} />
</Route>
```
Rutele Core HR rămân neschimbate. Anunțuri/Chat/Arhivă/Activități/Securitate rămân accesibile și pe rutele vechi (pentru linkuri externe & notificări existente).

## 6. Permisiuni

- Acces general `/social/*` = orice utilizator autentificat.
- „+ Creează comunitate" + tab „Cereri" + `/social/setari` = `canManageHR || isSuperAdmin`.
- „Echipa Mea" rămâne în Core HR cu logica existentă (manageri/șefi/approveri).

## 7. Diferențiere vizuală hub-uri

| | Core HR | Social |
|---|---|---|
| Sidebar bg | gradient mov existent | alb pur |
| Item activ | gradient mov | `bg-primary/8 border border-primary/20` |
| Densitate | compactă | airy, spațiere mare |
| Card style | existing | `rounded-xl border shadow-sm` curat |

## 8. Out of scope (iterații viitoare)

- Tabele DB: `social_posts`, `communities`, `community_members`, `community_events`, `social_settings_kv`.
- Persistare toggle-uri Setări sociale.
- Flag `show_birthday` în `profiles` + opt-in din My Profile.
- Organigramă interactivă completă (react-flow, drag, manageri ierarhic real).
- Postări reale, comentarii, like-uri, evenimente comunitate.
- Notificări feed/comunități.

## 9. Detalii tehnice

- Pagini noi în `src/pages/social/`, componente helper în `src/components/social/`.
- Reutilizez componentele shadcn existente: `Card`, `Tabs`, `Popover`, `Input`, `Button`.
- HubSwitcher folosește `Popover` + animație default radix.
- Fără modificări DB, fără edge functions noi.

## Diagramă

```text
┌─────────────────────────────────────────────┐
│ Header: [search]  [Vee]  [⊞ HUB]  [👤]      │
│                          └→ Popover:        │
│                             ◉ Core HR       │
│                             ○ Social        │
├──────────┬──────────────────────────────────┤
│ Sidebar  │  Outlet                          │
│ (variant │  • Core: Dashboard, Profil, …    │
│  switch) │  • Social: Feed, Comunități, …   │
└──────────┴──────────────────────────────────┘
```
