# Pagina principală nouă 2026–2027

Aceeași temă de acum (culorile ICMPP, indigo #3a3b8d, stil sticlă luminoasă), doar mai curată, mai personală și mai rapidă.

## 1. Pagina principală refăcută
```text
+-----------------------------------------------------------+
| Bună dimineața, Codrin · marți 10 nov · 12°C   [Ctrl+K 🔍] |
| „Azi: 2 evenimente · 1 cerere de aprobat · sold 23 zile"   |
+-----------------------------------------------------------+
| [Sold concediu] [Ultimul fluturaș] [Cereri] [Rezervări]    |  <- carduri-sumar
+-------------------------------+---------------------------+
| Avizier (rotativ)             | Agenda mea azi / mâine    |
| Anunțuri importante           | Concediul meu             |
| Cererile mele                 | Noutăți platformă         |
+-------------------------------+---------------------------+
| [Personalizează pagina]                                    |
+-----------------------------------------------------------+
```
- Salut mai scurt, cu o propoziție-rezumat a zilei (ce am de făcut azi).
- Rând de carduri-sumar cu cifre mari: sold concediu, ultimul fluturaș, cereri în așteptare, rezervări sală.
- Acțiunile rapide mutate în căutarea Ctrl+K și în carduri, ca pagina să fie mai aerisită.
- Animații discrete la încărcare, carduri cu margini fine, merge la fel de bine pe telefon.

## 2. Pagină personalizabilă
- Buton „Personalizează pagina": fiecare angajat alege ce carduri vede și în ce ordine (trage cu mouse-ul / degetul).
- Alegerea se salvează în cont, deci e aceeași pe calculator și pe telefon.
- Buton „Revino la varianta standard".
- Cardurile disponibile depind de rol (HR, șef, salarizare văd în plus cardurile lor).

## 3. Căutare rapidă tip comandă (Ctrl+K)
- Fereastra de căutare existentă devine centru de comandă: pe lângă oameni și pagini, poți face direct acțiuni:
  - „Cerere concediu nouă", „Fluturașul meu", „Rezervă sala", „Cartea mea de vizită", „Tichet IT".
- Secțiuni: Acțiuni · Oameni · Pagini · Recente.
- Pe telefon: buton de căutare vizibil sus.

## Ce rămâne neschimbat
Toate datele, permisiunile, avizierul, banner-ele Zoom/live, paginile pentru HR/șefi/super-admin (primesc doar noul aspect al cardurilor).

## Detalii tehnice
- Tabel nou `user_dashboard_layouts` (user_id, widgets jsonb ordonat, updated_at), RLS doar propriul rând.
- Registru central de widgeturi (`dashboardWidgets.ts`) cu id, titlu, componentă, roluri permise; `EmployeeDashboard` randează după layout salvat sau implicit.
- Componente noi: `DashboardHero` (salut + rezumat), `SummaryStrip`, `CustomizeDashboardSheet` (drag & drop cu @dnd-kit).
- `GlobalSearch` extins cu grup „Acțiuni" și „Recente" (localStorage).
- Test pentru filtrarea widgeturilor pe rol și ordinea implicită.
