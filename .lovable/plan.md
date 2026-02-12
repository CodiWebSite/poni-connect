
# Plan: Imbunatatiri Interfata si Navigare

Imbunatatiri vizuale si de UX pentru pagina de login, sidebar si dashboard, fara a schimba functionalitatea existenta.

---

## 1. Pagina de Login - Redesign

### Ce se schimba:
- Fundal cu gradient subtil si un pattern decorativ (blob-uri animate lent)
- Logo-ul ICMPP mai mare, cu un efect de glow subtil
- Card-ul de login cu efect glassmorphism mai pronuntat si shadow mai elegant
- Animatie de fade-in la incarcare pentru un aspect mai profesionist
- Captcha-ul sa fie mai bine integrat vizual (margini rotunjite, spacing uniform)
- Butonul de "Solicita ajutor" sa fie mai vizibil (nu doar text gri)

### Fisier modificat:
- `src/pages/Auth.tsx` - restructurare layout si stiluri

---

## 2. Sidebar - Imbunatatiri

### Ce se schimba:
- Adaugare tooltip pe iconite cand sidebar-ul e collapsed (acum nu stii ce face fiecare icon)
- Separator vizual intre sectiunile de navigare (ex: meniu principal vs. administrare)
- Badge cu numar de notificari pe item-urile relevante (ex: daca sunt cereri de concediu in asteptare pe "Gestiune HR")
- Animatie mai fluida la expand/collapse
- Buton de collapse mutat sus, langa logo (mai intuitiv)
- Evidentierea mai clara a item-ului activ (indicator lateral colorat, nu doar fundal)

### Fisiere modificate:
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/MobileNav.tsx` (sincronizare vizuala)

---

## 3. Dashboard - Reorganizare si Vizual

### Ce se schimba:
- Salut personalizat cu data curenta si un mesaj contextual (ex: "Buna dimineata" / "Buna ziua" in functie de ora)
- Stat card-uri cu gradient subtil pe fundal si micro-animatie la incarcare
- Sectiune "Acces rapid" vizibila pe dashboard (linkuri catre Profilul Meu, Calendar Concedii, Formulare) - carduri cu iconite mari
- Widget-ul meteo redesenat cu iconite animate si un layout mai compact
- Calendar departamental cu header mai clar si legenda integrata mai elegant

### Fisiere modificate:
- `src/pages/Dashboard.tsx` - adaugare Quick Actions
- `src/components/dashboard/EmployeeDashboard.tsx` - salut contextual cu ora
- `src/components/dashboard/StatCard.tsx` - gradient si animatii
- `src/components/dashboard/WeatherWidget.tsx` - layout compact

---

## 4. Header - Imbunatatiri minore

### Ce se schimba:
- Avatar-ul din header sa afiseze poza reala (acum e mereu fallback cu initiale, nu se incarca avatarul din profil)
- Breadcrumb simplu sub titlu care arata navigarea curenta

### Fisier modificat:
- `src/components/layout/Header.tsx`

---

## 5. Layout general - Bug fix

### Ce se schimba:
- Cand sidebar-ul e collapsed, `MainLayout` are `md:pl-64` hardcodat, deci continutul nu se reajusteaza. Se va lega de starea sidebar-ului pentru a ajusta padding-ul corect.

### Fisiere modificate:
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Sidebar.tsx` - expunere stare collapsed prin context

---

## Detalii tehnice

### Fisiere noi:
- `src/contexts/SidebarContext.tsx` - context React pentru starea collapsed/expanded a sidebar-ului, partajata intre Sidebar si MainLayout

### Fisiere modificate:
- `src/pages/Auth.tsx` - redesign vizual login
- `src/components/layout/Sidebar.tsx` - tooltips, separator, indicator lateral activ, buton collapse repozitonat, context
- `src/components/layout/MobileNav.tsx` - sincronizare stil cu sidebar
- `src/components/layout/MainLayout.tsx` - padding dinamic bazat pe context sidebar
- `src/components/layout/Header.tsx` - avatar real, breadcrumb
- `src/pages/Dashboard.tsx` - quick actions
- `src/components/dashboard/EmployeeDashboard.tsx` - salut contextual
- `src/components/dashboard/StatCard.tsx` - gradient si animatii
- `src/components/dashboard/WeatherWidget.tsx` - redesign compact

### Nu se modifica:
- Functionalitatea existenta (autentificare, CAPTCHA, roluri)
- Schema bazei de date
- Edge functions
