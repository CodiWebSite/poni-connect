
Plan: backup automat săptămânal direct în Google Drive personal.

Tehnic:
1. Conectare Google Drive prin connector (utilizatorul își alege contul personal).
2. Modific `supabase/functions/backup-data/index.ts` să încarce JSON-ul în Drive după generare, prin gateway Lovable: `https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart`.
3. Folder dedicat „ICMPP Backups" — creat automat dacă nu există (search + create via Drive API).
4. Salvez `drive_file_id` și link-ul în `backup_logs` (co