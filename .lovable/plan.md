

# Plan: Sistem Complet de Instruire și Ghidare

Combinăm toate cele 4 opțiuni într-un sistem integrat de ajutor pentru utilizatori.

---

## 1. Tour Interactiv la Prima Autentificare (Onboarding)

**Ce se creează:**
- Tabel `user_onboarding` (user_id, tour_completed, completed_at) pentru a ține evidența cine a parcurs tour-ul
- Componentă `OnboardingTour` care apare ca un overlay modal pas-cu-pas
- 6-8 pași care evidențiază: sidebar-ul, profilul, cerere concediu, calendar concedii, formulare, setări
- Fiecare pas are titlu, descriere, și o săgeată/highlight spre elementul vizat
- Butoane "Următorul", "Înapoi", "Sari peste tour"
- La final, marchează tour-ul ca completat în baza de date
- Buton în Setări pentru a relua tour-ul oricând

**Pașii tour-ului:**
1. Bun venit pe platforma ICMPP
2. Sidebar-ul - navigare principală
3. Profilul Meu - datele tale personale
4. Cerere Concediu - cum trimiți o cerere
5. Calendar Concedii - vezi concediile echipei
6. Formulare - descarcă documente utile
7. Setări - personalizează experiența
8. Ghid Platformă - ajutor permanent disponibil

---

## 2. Pagină "Ghid Platformă" (/ghid)

**Ce se creează:**
- Pagina `src/pages/PlatformGuide.tsx` accesibilă din sidebar (iconiță BookOpen/HelpCircle)
- Secțiuni cu acordeoane organizate pe roluri:

**Pentru toți angajații:**
- Cum îmi completez profilul
- Cum fac cerere de concediu (pas cu pas)
- Cum descarc formulare
- Cum văd calendarul de concedii
- Cum schimb tema (dark/light)

**Pentru șefi de laborator:**
- Cum aprob/resping concedii
- Cum văd cererile echipei

**Pentru HR:**
- Gestiune angajați
- Import date
- Export rapoarte

**Pentru administratori:**
- Setări platformă
- Gestionare conturi și roluri

Fiecare secțiune cu pași numerotați și explicații clare.

---

## 3. Help Contextual (butoane ?)

**Ce se creează:**
- Componentă reutilizabilă `ContextualHelp` - un buton mic `?` care deschide un popover/dialog cu explicații
- Se plasează pe paginile principale:
  - Dashboard: explicație generală
  - Profilul Meu: cum se editează datele
  - Cerere Concediu: fluxul de aprobare
  - Calendar Concedii: cum se interpretează culorile
  - Formulare: cum se descarcă și completează
  - HR Management: instrucțiuni de gestiune
- Textele sunt hardcodate în română, specifice fiecărei pagini

---

## 4. Materiale Descărcabile

**Ce se creează:**
- Pe pagina Ghid Platformă, secțiune cu butoane de descărcare
- Generare PDF cu `docx` sau link către un PDF static din `/public/templates/`
- Se creează un fișier `/public/templates/Ghid_Platforma_ICMPP.pdf` placeholder
- Alternativ, secțiunea de pe pagina ghid poate fi printată direct din browser (buton "Printează ghidul")

---

## Structura fișierelor noi

```text
src/
├── components/
│   ├── onboarding/
│   │   └── OnboardingTour.tsx          # Tour interactiv pas-cu-pas
│   └── shared/
│       └── ContextualHelp.tsx          # Buton ? reutilizabil
├── pages/
│   └── PlatformGuide.tsx               # Pagina Ghid Platformă
```

## Modificări la fișiere existente

- `App.tsx` - adaugă ruta `/ghid`
- `Sidebar.tsx` - adaugă link "Ghid Platformă" în meniul principal
- `MainLayout.tsx` - integrează `OnboardingTour`
- `src/pages/Dashboard.tsx` - adaugă `ContextualHelp`
- `src/pages/MyProfile.tsx` - adaugă `ContextualHelp`
- `src/pages/LeaveRequest.tsx` - adaugă `ContextualHelp`
- `src/pages/LeaveCalendar.tsx` - adaugă `ContextualHelp`
- `src/pages/FormTemplates.tsx` - adaugă `ContextualHelp`
- `src/pages/Settings.tsx` - buton "Reia tour-ul"
- Migrare DB: tabel `user_onboarding`

---

## Detalii tehnice

- Tour-ul folosește CSS highlights (box-shadow overlay) fără dependențe externe
- Starea tour-ului se persistă în `user_onboarding` cu RLS policy (utilizatorul vede doar propria înregistrare)
- `ContextualHelp` e un `Popover` cu text și link opțional spre pagina de ghid
- Pagina ghid filtrează secțiunile pe baza rolului utilizatorului (useUserRole)
- Buton "Printează" pe pagina ghid folosește `window.print()` cu CSS `@media print`

