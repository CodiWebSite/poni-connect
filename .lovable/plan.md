

# Plan: Dashboard Inteligent Diferențiat pe Rol — ICMPP

## Rezumat

Înlocuirea dashboard-ului actual (care are doar 2 variante: admin vs employee) cu un sistem modular de dashboard-uri specializate pe rol. Fiecare rol primește componente specifice responsabilităților sale, organizate ierarhic: alerte → acțiuni → statistici → activitate → scurtături.

## Arhitectura

```text
src/pages/Dashboard.tsx                          (router pe rol)
src/components/dashboard/
  ├── SuperAdminDashboard.tsx                    (NOU — Control Center complet)
  ├── HRDashboard.tsx                            (NOU — centru operațional HR)  
  ├── SefDepartmentDashboard.tsx                 (NOU — echipă + aprobări)
  ├── MedicMunciiDashboard.tsx                   (NOU — fișe medicale + alerte)
  ├── OperationalRoleDashboard.tsx               (NOU — roluri de serviciu generic)
  ├── EmployeeDashboard.tsx                      (REFĂCUT — orientat pe acțiune)
  ├── DashboardAlertsBanner.tsx                  (NOU — alerte urgente universale)
  ├── PendingActionsWidget.tsx                   (NOU — "Necesită acțiune")
  ├── SystemHealthMini.tsx                       (NOU — mini status sistem pt SA)
  ├── QuickActionsGrid.tsx                       (NOU — grid reutilizabil scurtături)
  ├── ... (componente existente păstrate)
```

## Dashboard pe Rol — Detalii

### 1. SuperAdminDashboard.tsx
**Secțiuni** (în ordine):
- **Alerte Sistem** — edge functions down, backup vechi, storage plin, erori recente (din `health_check_logs`)
- **Necesită Atenție** — utilizatori fără rol (profiles vs user_roles), angajați fără cont, tichete helpdesk noi, cereri cont noi, cereri HR pending
- **Stare Sistem** — mini cards: Auth OK, DB OK, Storage OK, Edge Functions OK (din ultimul health check)
- **Statistici** — total utilizatori, angajați activi, online acum (OnlineUsersWidget), activare conturi (ActivationChart)
- **Analytics Adopție** — AnalyticsWidget + AdoptionTrendChart (existente)
- **Activitate Administrativă** — ultimele 15 audit_logs
- **Acțiuni Rapide** — Creează Cont, Gestionează Roluri, Audit, Admin, System Health, Cereri Pendinte

### 2. HRDashboard.tsx (pentru rolurile `hr` și `sef_srus`)
**Secțiuni**:
- **Alerte HR** — documente expirate, CI expirate, fișe medicale expirate
- **Necesită Acțiune** — cereri corecție date pending, adeverințe pending, concedii la nivel SRUS/HR
- **Statistici HR** — angajați activi, fără cont, fără rol, documente lipsă
- **HRAlerts** (componenta existentă, integrată)
- **Concedii pe Departament** — LeaveByDepartment (existent)
- **Activitate HR** — ultimele acțiuni HR din audit_logs
- **Acțiuni Rapide** — Deschide HR, Documente, Cereri, Calendar Concedii, Alerte

### 3. SefDepartmentDashboard.tsx (pentru `sef`, `director_institut`, `director_adjunct`, `secretar_stiintific`)
**Secțiuni**:
- **Cereri de Aprobat** — leave requests pending la semnătura șefului (din `hr_requests` cu status pending)
- **Echipa Azi** — cine e absent, cine intră în concediu curând
- **Rezumat Echipă** — total membri departament, în concediu, activi
- **Activitate Departament** — ultimele acțiuni
- **Acțiuni Rapide** — Aprobă Cereri, Echipa Mea, Calendar Departament, Profil

### 4. MedicMunciiDashboard.tsx
**Secțiuni**:
- **Alerte Medicale** — fișe expirate, fișe care expiră în 30/60/90 zile (din `medical_dossiers.next_checkup_date`)
- **Statistici** — total dosare, expirate, expiră curând
- **Acțiuni Rapide** — Zona Medicală, Dosare, Calendar

### 5. OperationalRoleDashboard.tsx (bibliotecar, salarizare, secretariat, achizitii, contabilitate, oficiu_juridic, compartiment_comunicare)
Dashboard compact generic:
- **Notificări Relevante** — ultimele notificări
- **Anunțuri** — DashboardAnnouncements
- **Sold Concediu** — widgetul personal existent
- **Acțiuni Rapide** — personalizate pe rol (ex: bibliotecar → Bibliotecă; salarizare → Salarizare)
- **Activitate Personală** — ActivityHistory

### 6. EmployeeDashboard.tsx (REFĂCUT — pentru `user`)
Structura actualizată:
- **Anunțuri Urgente** — banner dacă există
- **Cererile Mele** — statusul ultimelor cereri HR (pending/approved/rejected) cu badge-uri
- **Sold Concediu** — ring progress (existent, păstrat)
- **Documentele Mele** — count documente, alerte dacă lipsesc
- **Activitate Recentă** — ActivityHistory (existent)
- **Acțiuni Rapide** — Cerere Concediu, Profilul Meu, Documentele Mele, Calendar, Formulare

## Routing în Dashboard.tsx

```typescript
// Dashboard.tsx devine un router simplu
const Dashboard = () => {
  const { role, isSuperAdmin, isHR, isSefSRUS, isSef, isMedicMuncii } = useUserRole();
  
  if (isSuperAdmin) return <SuperAdminDashboard />;
  if (isHR || isSefSRUS) return <HRDashboard />;
  if (role === 'sef' || role === 'director_institut' || ...) return <SefDepartmentDashboard />;
  if (isMedicMuncii) return <MedicMunciiDashboard />;
  if (['bibliotecar','salarizare',...].includes(role)) return <OperationalRoleDashboard />;
  return <EmployeeDashboard />;
};
```

## Componente Reutilizabile Noi

### QuickActionsGrid.tsx
Grid configurabil de acțiuni rapide, acceptă array de `{icon, label, path, gradient}`.

### PendingActionsWidget.tsx
Card cu lista de elemente care necesită acțiune, cu badge-uri numerice, link-uri și severitate (warning/critical/info).

### DashboardAlertsBanner.tsx
Banner alert universal pentru mesaje urgente (homepage_message + anunțuri urgente).

### SystemHealthMini.tsx
4 mini-cards cu statusul serviciilor (query `health_check_logs` ultimul row).

## Surse de Date

Toate datele vin din tabelele existente — nu sunt necesare migrații:
- `employee_personal_data` — statistici angajați, CI expiry
- `employee_records` — sold concediu
- `hr_requests` — cereri pending
- `data_correction_requests` — corecții pending  
- `helpdesk_tickets` — tichete noi
- `account_requests` — cereri cont
- `user_roles` + `profiles` — utilizatori fără rol
- `health_check_logs` — stare sistem
- `audit_logs` — activitate recentă
- `medical_dossiers` — fișe medicale expirate
- `employee_documents` — documente lipsă/expirate

## Design

- Cards cu gradient pe icon, hover elevation
- Alerte: roșu (critical), amber (warning), verde (ok), albastru (info)
- Badge-uri numerice pe acțiuni pending
- Skeleton shimmer pe loading
- Empty states cu icon + mesaj + sugestie
- Layout responsive: grid colapse pe mobil
- Ierarhie clară: alerte → acțiuni → statistici → activitate → scurtături

## Pași de Implementare

1. Creează componentele reutilizabile (QuickActionsGrid, PendingActionsWidget, DashboardAlertsBanner, SystemHealthMini)
2. Creează SuperAdminDashboard cu toate secțiunile
3. Creează HRDashboard  
4. Creează SefDepartmentDashboard
5. Creează MedicMunciiDashboard
6. Creează OperationalRoleDashboard
7. Refă EmployeeDashboard cu focus pe acțiuni proprii
8. Refă Dashboard.tsx ca router pe rol
9. Păstrează componentele existente (StatCard, WeatherWidget, etc.) integrate în dashboard-urile noi

