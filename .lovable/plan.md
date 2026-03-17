

# MyProfile — Design Refresh 2026

Pagina are deja o structură bună cu hero header, two-column layout și secțiuni logice. Îmbunătățirile sunt strict vizuale — fac totul mai modern, mai aerisit și cu micro-animații.

## Ce se schimbă

### 1. Hero Header — Glass + Depth
- Avatar: `rounded-2xl` → `rounded-full` cu **gradient ring animat** (rotate 360° la 4s) și shadow glow
- Background: gradient mai vibrant cu **pattern dots overlay** subtil
- Status badge verde: pulsing animation
- Badges (rol, departament): glassmorphism cu backdrop-blur
- Quick contact pills: hover lift effect

### 2. Leave Balance — Vizualizare mai premium
- "Sold Total Disponibil" card: **ProgressRing circular mare** centrat (deja importat dar nefolosit efectiv aici) + gradient background mai pronunțat
- Year cards (2026/2025): **mini progress bar** sub fiecare (folosit / total) cu culori gradiente
- Cifre mari: font-display cu animated counter (hook-ul `useAnimatedCounter` e deja importat)
- Bonus card: **shimmer effect** subtil pe border

### 3. Leave History — Timeline style
- Înlocuim lista plată cu un **timeline vertical** (linie stângă + dot colorat per status)
- Status dot: verde approved, amber pending, roșu rejected
- Hover: card lift + left-border accent coloring
- Date range: font mai bold, format mai vizual

### 4. Personal Data — Card redesign
- CNP: **monospace font mare** cu letter-spacing generos + copy button
- CI card: layout horizontal cu icon mare stilizat
- Adresă: mini-map icon stilizat
- Toate data fields: **label-above-value** layout mai curat cu gap consistent

### 5. Documents — File cards
- Fiecare document: **icon colorat per tip** (PDF roșu, DOC albastru, etc.) în loc de icon uniform
- Download button: hover glow + scale
- Empty state: ilustrație SVG inline minimalistă

### 6. Approver Card — Visual upgrade
- Avatar placeholder → **gradient circle** cu inițiale
- Delegation card: timeline indicator vizual (punct start → punct end)

### 7. Correction Request — Rebranding
- Din border-dashed → **glassmorphism card** cu gradient border subtil
- Icon: AlertTriangle → MessageSquare sau HelpCircle (mai prietenos)
- Text mai invitant

### 8. Animații & Tranziții
- Cards: staggered fade-in la load (delay 50ms per card)
- Numere în leave balance: animated counter (hook existent)
- Avatar hover: scale 1.05 + ring glow intensificat

## Fișiere modificate
- `src/pages/MyProfile.tsx` — doar clase CSS, structura JSX vizuală, activare animated counters
- `src/index.css` — adăugăm 2-3 utilități noi (gradient-ring, timeline-dot)

## Ce NU se schimbă
- Toată logica de fetch (profile, leave, documents, approver, delegate)
- Structura datelor și tipurile
- Upload avatar + crop dialog
- CorrectionRequestForm
- RLS, queries, hooks

