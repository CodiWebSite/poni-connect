

# Plan: Script de re-deploy Edge Functions pe Supabase propriu

## Ce se va crea

Un fișier Markdown descărcabil (`/mnt/documents/Deploy_Edge_Functions_Guide.md`) care conține:

1. **Script Bash complet** (`deploy-all-functions.sh`) care deployează automat toate cele 25 de Edge Functions pe un proiect Supabase nou, respectând configurația `verify_jwt` din `config.toml`
2. **Tabel cu toate funcțiile** — nume, descriere, `verify_jwt`, secrete necesare
3. **Instrucțiuni pas cu pas** pentru:
   - Instalare Supabase CLI
   - Conectare la proiectul nou (`supabase link`)
   - Configurare secrete (`supabase secrets set`)
   - Rulare script deploy
   - Verificare post-deploy
4. **Script de verificare** care testează fiecare funcție deployată

### Funcții acoperite (25 total):

| Funcție | verify_jwt | Secrete speciale |
|---|---|---|
| auth-email-hook | false | LOVABLE_API_KEY |
| backup-data | false | — |
| backup-storage | true | — |
| check-ip-access | false | — |
| check-medical-expirations | true | SMTP_* |
| cleanup-audit-logs | false | — |
| create-user | true | — |
| delete-user | true | — |
| export-database | false | — |
| health-check | true | — |
| import-employees | true | — |
| invite-user | false | SMTP_* |
| log-auth-event | true | — |
| notify-leave-email | true | SMTP_* |
| notify-leave-result | true | SMTP_* |
| notify-maintenance-end | true | SMTP_* |
| remind-leave-approvers | false | SMTP_* |
| reply-helpdesk | true | SMTP_* |
| send-promo-email | true | SMTP_* |
| send-reminder-email | true | SMTP_* |
| sync-employee-emails | true | — |
| sync-employees | true | — |
| test-email | false | SMTP_* |
| verify-inventory-pin | false | — |
| verify-turnstile | false | TURNSTILE_SECRET_KEY |

### Implementare
- Se generează documentul cu `code--exec` și se salvează în `/mnt/documents/`
- Include script-ul bash gata de copiat și rulat
- Nu necesită modificări la codul proiectului

