

# Audit & Design Refresh — Plan complet

## PARTEA 1: Cod rezidual / neutilizat de șters

### Pagini orfane (nu sunt importate/rutat nicăieri în App.tsx)
1. **`src/pages/AIAssistant.tsx`** — Modulul AI Assistant a fost eliminat conform memoriei platformei, dar fișierul există încă (200 linii). Nu are rută în App.tsx. **De șters.**
2. **`src/pages/IntranetUpdates.tsx`** — 319 linii, nu e importat nicăieri. **De șters.**
3. **`src/pages/Documents.tsx`** — 422 linii, nu e importat în App.tsx (există Archive separat care face aceeași treabă). **De șters.**
4. **`src/pages/Employees.tsx`** — 188 linii, nu e importat în App.tsx (directorul de angajați e acum în alt loc). **De șters.**

### Componente dashboard nefolosite
5. **`src/components/dashboard/BirthdayWidget.tsx`** — 213 linii, nu e importat nicăieri (eliminat din dashboard conform memoriei). **De șters.**
6. **`src/components/dashboard/UpcomingEvents.tsx`** — 58 linii, neimportat. **De șters.**
7. **`src/components/dashboard/QuickLinks.tsx`** — 81 linii, neimportat (înlocuit cu Quick Actions din Dashboard.tsx). **De șters.**

### Fișiere potențial de revizuit
8. **`src/components/dashboard/SpringDecoration.tsx`** — Hardcodat pe luna martie (month === 2). Decorațiune sezonieră. Se poate păstra dar e nișă.
9. **`supabase/functions/ai-assistant/index.ts`** — Edge function pentru AI Assistant care nu mai e folosit. **De șters.**

**Total cod rezidual: ~1.480+ linii de șters.**

---

## PARTEA 2: Buguri și probleme observate

1. **Sidebar: N+1 queries pe chat unread** — Sidebar.tsx face un query per conversație într-un `for` loop (liniile 106-124). Cu mulți participanți, asta generează zeci de queries. Trebuie consolidat într-un singur query.
2. **Header duplicare import** — `lucide-react` e importat de 2 ori (linia 8 și linia 14 în Header.tsx — `Sun, Moon, ChevronRight` + `FlaskConical, X`).
3. **z-index inconsistency** — Header folosește `z-40`, demo banner `z-39` (nu e valid Tailwind standard). De aliniat.
4. **`SpringDecoration`** apare de 2 ori pe dashboard admin (o dată direct, o dată prin EmployeeDashboard) — nu e bug vizibil dar e redundant.

---

## PARTEA 3: Design Refresh — Modern 2026

### Principii
- **Glass morphism avansat** cu blur mai pronunțat și gradienți subtili
- **Micro-animații** pe hover, focus, tranziții de pagină
- **Spațiere mai aerisită**, tipografie mai curată
- **Cards cu border subtil + shadow layered** (nu flat, nu excesiv)
- **Sidebar redesign**: gradient background, iconuri cu glow pe hover, tranziție smooth
- **Color palette refresh**: Păstrăm tonurile de albastru dar adăugăm accent-uri mai vibrante

### Schimbări concrete

#### A. CSS Variables & Palette (index.css)
- Shadows mai layered (multi-stop)
- Border-radius crescut la `0.75rem`
- Background ușor mai cald (`210 15% 98%` → `220 14% 97%`)
- Card shadow cu 3 nivele (ambient + key + fill)
- Noi variabile: `--glass-bg`, `--glass-border`, `--gradient-sidebar`

#### B. Sidebar (Sidebar.tsx)
- Gradient vertical de background (nu flat `220 30% 12%`)
- Active item: pill glow effect cu border-left accent colorat
- Hover: translateX micro-shift + opacity fade
- User avatar ring animat subtil
- Secțiuni cu divider mai discret
- Font size ușor mai mare pe labels

#### C. Header (Header.tsx)  
- Height redus, padding mai compact
- Glass effect mai pronunțat (`backdrop-blur-xl`)
- Search bar integrat vizual (nu doar icon)
- Avatar cu status indicator (online dot)
- Tranziție smooth pe breadcrumb

#### D. Cards (card.tsx + StatCard.tsx)
- Shadow layered: `0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)`
- Hover: lift + glow subtil
- Border: `border-border/60` (mai fin)
- StatCard: icon background cu gradient, value cu font-display

#### E. Buttons (button.tsx)
- Tranziții mai smooth (300ms)
- Default: shadow layered
- Hover: translateY(-1px) + shadow grow
- Focus ring: offset mai mare, culoare mai vizibilă

#### F. Dashboard Layout
- Grid gap crescut
- Cards cu enter animation staggered (delay pe fiecare)
- Widget-uri cu header redesign (icon + title inline, separator subtil)

#### G. Auth Page (Auth.tsx)
- Full-screen layout cu ilustrație/gradient pe jumătate
- Card centrat cu glass effect
- Input-uri cu icon prefix integrat
- Tranziții animate pe tab switch

#### H. Tailwind Config
- Noi keyframes: `glow-pulse`, `slide-in-left`, `float-subtle`
- Shadows actualizate la multi-layer

### Ce NU se schimbă
- Logica de business, queries, RLS, roluri
- Structura de rute și navigare  
- Funcționalitățile existente (leave, HR, medical, chat, etc.)
- Datele din baza de date

---

## PARTEA 4: Optimizări de performanță

1. **Sidebar chat badge** — Consolidare N+1 într-un singur RPC sau query cu aggregate
2. **Dashboard fetches** — useEffect fără dependency array corect pe `isAdminDashboard` (se apelează de mai multe ori)
3. **Header double fetch** — Atât Sidebar cât și Header fetch avatar/profile separat. De extras într-un hook comun `useCurrentUser`
4. **Lazy loading pagini** — Paginile mari (HRManagement 1000+ linii, SystemStatus 980 linii) ar beneficia de `React.lazy`

---

## Ordine de implementare

1. Ștergere cod rezidual (7 fișiere + 1 edge function)
2. Fix buguri (sidebar N+1, imports duplicate, z-index)
3. Design system update (CSS vars, shadows, radius, glass utilities)
4. Component redesign (Card, Button, Sidebar, Header, StatCard)
5. Dashboard layout refresh
6. Auth page redesign
7. Optimizări performanță (lazy loading, hook comun profil)

