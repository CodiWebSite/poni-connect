

# Sidebar Modern Redesign 2026

## Ce se schimba

Sidebar-ul actual e functional dar arata clasic — liste plate, hover simplu, borders dure. Propun un redesign vizual complet pastrand toata logica existenta (badges, roluri, chat, demo mode, IT contact).

### 1. Layout & Spacing
- **Padding crescut** pe nav items (py-2.5 → py-2 dar cu gap mai mare intre sectiuni)
- **Icon size uniform** 18px (de la 20px) — mai delicat, mai modern
- **Nav items mai compacte** — font-size 13px, letter-spacing subtil
- **Scrollbar custom** stilizat thin (4px, translucent)

### 2. Active State Redesign
- Inlocuim `border-l-2` cu un **pill background cu gradient subtil** + glow shadow
- Active icon primeste culoarea primara cu un **dot indicator mic** (4px) langa icon in collapsed mode
- Text bold pe active item

### 3. Hover Effects
- **Background reveal** cu opacity transition (nu translate-x)
- Icon color transition smooth (0.2s)
- **Subtle scale** pe icon la hover (1.05x)

### 4. Header Rebrand
- Logo cu **ring glow animat subtil** (pulse la 3s interval)
- Titlul "ICMPP" cu gradient text
- Collapse button cu **rotate animation** pe chevron (180deg smooth)
- Separator mai subtil (gradient fade din transparent)

### 5. User Section
- Avatar cu **ring gradient border** (2px, primary gradient)
- **Online status dot** verde (8px, absolute bottom-right pe avatar)
- Hover pe user card: **glass background** cu blur

### 6. Section Labels
- Labels "Meniu Principal" / "Administrare" cu **line-through design**: `— Meniu Principal —`
- Opacity transition la scroll

### 7. Footer Modernizare
- Buton deconectare: icon-only by default, text apare pe hover (slide-in)
- Separator footer: gradient line (transparent → border → transparent)
- Demo toggle: neon glow cand activ (amber neon)

### 8. Collapsed Mode
- **Centered icons** cu tooltip glassmorphism
- Active item: **circular glow** background in loc de pill
- Smooth width transition (300ms cubic-bezier)

### 9. Scrollbar Custom (CSS)
- Thin 4px scrollbar cu culoare sidebar-accent
- Hover: 6px width expansion
- Track transparent

### 10. CSS Additions (index.css)
- `.sidebar-item-active` — gradient bg + glow shadow utility
- `.sidebar-scrollbar` — custom scrollbar styles
- `.gradient-border` — pseudo-element gradient ring

### Fisiere modificate
- `src/components/layout/Sidebar.tsx` — doar clase CSS si structura JSX vizuala
- `src/index.css` — adaugam utilitati sidebar custom
- `tailwind.config.ts` — eventual keyframe nou pentru rotate chevron

### Ce NU se modifica
- Logica de fetch (badges, chat unread, profile)
- Roluri si items conditionale
- Realtime subscriptions
- ITContactDialog, DemoMode, SignOut logic
- SidebarContext (collapse state)

