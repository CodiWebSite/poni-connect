

# Plan: Refacere completă Admin Panel — Centru de Control Operațional ICMPP

## Rezumat

Transformarea paginii Admin dintr-o colecție de 16 tab-uri într-un hub structurat pe 5 secțiuni majore: **Overview**, **Users**, **Roles & Access**, **System Health**, **Audit**. Fiecare secțiune devine o componentă modulară dedicată, cu design enterprise premium.

## Structura noilor fișiere

```text
src/pages/Admin.tsx                          (refăcut — 5 tab-uri principale)
src/components/admin/
  ├── AdminOverview.tsx                      (NOU — dashboard cu KPI-uri + alerte)
  ├── AdminUsersPanel.tsx                    (NOU — management complet utilizatori)
  ├── AdminRolesAccessPanel.tsx              (NOU — matrice roluri + permisiuni)
  ├── AdminSystemHealth.tsx                  (NOU — diagnostic + status servicii)
  ├── AdminAuditPanel.tsx                    (NOU — audit avansat cu filtre + export)
  ├── ... (componentele existente rămân)
```

## Secțiunile detaliate

### 1. Overview (AdminOverview.tsx)

**KPI Cards** (grid 2x3 sau 3x2 responsive):
- Total utilizatori (query `profiles` count)
- Angajați fără cont (query `employee_personal_data` WHERE `employee_record_id IS NULL` și fără match email în profiles)
- Conturi fără rol (profiles LEFT JOIN user_roles WHERE role IS NULL)
- Cereri concediu în așteptare (leave_requests WHERE status = 'pending')
- Storage buckets status (count din bucket-uri)
- Edge functions status (invoke `health-check`)

**Alerte prioritare** — card cu listă colorată:
- Angajați fără cont (galben)
- Conturi fără rol (roșu)
- Backup lipsă (roșu) — verificare audit_logs pentru ultima acțiune de backup
- Funcții indisponibile (roșu) — din health-check

**Activitate recentă** — timeline cu ultimele 10 audit_logs entries, format vizual cu avatar + acțiune + timestamp.

### 2. Users (AdminUsersPanel.tsx)

Preia și extinde logica existentă din Admin.tsx (fetchUsers, updateUserRole, deleteUser, toggleBypass). Include:

- **Toolbar**: search + filtre dropdown (rol, departament, status cont)
- **Tabel** profesional (nu carduri) cu coloane: Avatar+Nume, Email (din auth via edge function sau profiles), Departament, Funcție, Rol(uri), IP Bypass, Status, Acțiuni
- **Sub-taburi**: Toți / Fără cont / Fără rol
- **Acțiuni rapide** per rând: schimbă rol, toggle bypass, resetează (invoke edge fn), șterge (cu confirmare dialog existentă)
- **Panel lateral** (sheet) la click pe user: detalii complete + timeline audit per user
- Integrează componentele existente ca sub-secțiuni: ManualAccountCreate, AccountRequestsPanel, InvitePlatformPanel, AccountReminderPanel, PreAssignRoles

### 3. Roles & Access (AdminRolesAccessPanel.tsx)

Reorganizează OperationalRulesPanel + CustomRolesManager + AccessMatrixEditor:

- **Matrice vizuală** rol × pagină cu checkbox-uri colorate
- **Preview rol** — buton "Previzualizare" pe fiecare rol care arată lista modulelor accesibile
- **Secțiune roluri custom** (CustomRolesManager existent)
- **Statistici**: utilizatori per rol (bar chart simplu), roluri nefolosite, utilizatori cu roluri multiple
- **Audit roluri** — filtrare audit_logs WHERE entity_type = 'user_role'
- Integrează: ApprovalWorkflowEditor, RequestRoutingEditor, NotificationRulesEditor (ca sub-tab-uri)

### 4. System Health (AdminSystemHealth.tsx)

**Status Grid** (carduri cu indicator verde/galben/roșu):
- Database: query simplă SELECT 1
- Auth: supabase.auth.getSession() test
- Storage: list dintr-un bucket test
- Edge Functions: invoke `health-check`
- Email: invoke `test-email` (buton manual)

**Diagnostice rapide** (butoane):
- Test edge functions (invocă health-check)
- Test email (invocă test-email)
- Test storage (listează un bucket)
- Verifică inconsistențe utilizatori (profiles vs user_roles vs employee_records)
- Verifică documente lipsă (employee-documents entries fără obiect storage)

**Rezultate** — listă cu badge-uri success/warning/error + descriere + recomandare.

Integrează: UptimeMonitorPanel (link extern Uptime Kuma), AppSettingsPanel (Setări sistem), EquipmentRegistry.

### 5. Audit (AdminAuditPanel.tsx)

Extinde AuditLog.tsx existent cu:

- **Filtre avansate**: utilizator, acțiune, modul (entity_type), perioadă (date range picker), severitate
- **Vizualizare timeline** — per utilizator sau per entitate
- **Detalii expandabile** per rând — JSON details formatat frumos
- **Export**: CSV + PDF (folosind utilitare existente de export)
- **Sub-tab AuthLoginLog** — jurnalul de autentificări existent
- Paginare robustă cu count total

## Design & UX

- **Navigare principală**: 5 tab-uri mari cu iconuri, text clar, stil segment-control cu slider animat
- **Culori status**: `text-emerald-500` (healthy), `text-amber-500` (warning), `text-destructive` (critical), `text-blue-500` (info)
- **Carduri KPI**: gradient subtil pe icon, animație counter (useAnimatedCounter existent)
- **Tabele**: componenta Table existentă, hover states, sort headers
- **Loading**: skeleton shimmer pattern (existent în proiect)
- **Empty states**: icon + mesaj descriptiv + acțiune sugerată
- **Acțiuni critice**: Dialog de confirmare (pattern existent)
- **Responsive**: grid auto-fit, tabele cu scroll orizontal pe mobil

## Componente existente redistribuite

| Componentă actuală | Secțiunea nouă |
|---|---|
| User list + roles (inline în Admin.tsx) | Users |
| PreAssignRoles | Users → sub-tab |
| ManualAccountCreate | Users → sub-tab |
| AccountRequestsPanel | Users → sub-tab |
| InvitePlatformPanel | Users → sub-tab |
| AccountReminderPanel | Users → sub-tab |
| AuditLog | Audit (extins) |
| AuthLoginLog | Audit → sub-tab |
| OperationalRulesPanel (5 sub-taburi) | Roles & Access |
| AccessMatrixEditor | Roles & Access |
| CustomRolesManager | Roles & Access |
| AppSettingsPanel | System Health → sub-tab |
| UptimeMonitorPanel | System Health → sub-tab |
| EquipmentRegistry | System Health → sub-tab |
| HelpdeskPanel | Users → sub-tab |
| AnnouncementPublishersPanel | Roles & Access → sub-tab |
| EventPublishersPanel | Roles & Access → sub-tab |

## Pași de implementare

1. Creează `AdminOverview.tsx` — dashboard KPI cu queries reale
2. Creează `AdminUsersPanel.tsx` — extrage logica din Admin.tsx, adaugă tabel + filtre + sub-taburi
3. Creează `AdminRolesAccessPanel.tsx` — reorganizează componentele de acces
4. Creează `AdminSystemHealth.tsx` — status checks + diagnostice
5. Creează `AdminAuditPanel.tsx` — audit avansat cu filtre și export
6. Refă `Admin.tsx` — 5 tab-uri principale, cod curat, delegare la componente noi
7. Stilizare finală — spacing, animații, responsive polish

## Note tehnice

- Nu sunt necesare migrații SQL — toate datele există deja
- Queries noi folosesc tabele existente: `profiles`, `user_roles`, `employee_personal_data`, `employee_records`, `leave_requests`, `audit_logs`, `auth_login_log`, `ip_bypass_users`
- Edge functions existente: `health-check`, `test-email`, `delete-user`, `create-user`
- Componentele existente (AuditLog, AuthLoginLog, etc.) sunt refolosite ca sub-componente, nu rescrise

