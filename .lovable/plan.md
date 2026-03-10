

# Modul Medicină a Muncii — Implementat ✅

## Ce s-a creat

### Bază de date
- Rol nou `medic_medicina_muncii` în enum-ul `app_role`
- Enum-uri: `medical_fitness_status`, `consultation_type`, `exam_status`
- Funcții RLS: `can_manage_medical()`, `can_view_medical_status()`
- 4 tabele: `medical_records`, `medical_consultations`, `medical_scheduled_exams`, `medical_documents`
- Storage bucket privat: `medical-documents`
- RLS strict: medicul — acces complet; HR — doar status avize (SELECT)

### Pagini & componente
- `/medicina-muncii` — pagină principală cu dashboard, statistici, tabel angajați
- Fișă medicală per angajat cu tab-uri (info, consultații, programări, documente)
- Formulare CRUD: creare/editare fișă, adăugare consultație, programare examen
- Upload/descărcare/ștergere documente medicale

### Sidebar & routing
- Intrare „Medicină Muncii" vizibilă doar pentru `medic_medicina_muncii` și HR
- Rută `/medicina-muncii` în App.tsx

## Funcționalități implementate
1. ✅ Fișe medicale per angajat (apt/apt_conditionat/inapt/pending)
2. ✅ Istoric consultații medicale
3. ✅ Programări controale periodice cu status tracking
4. ✅ Upload documente medicale (bucket privat)
5. ✅ Statistici dashboard (total, apt, condiționat, inapt, expirate, expiră curând)
6. ✅ Filtrare pe departament și căutare
7. ✅ HR vede doar status avize, fără diagnostice/note

## De implementat ulterior
- Edge function `check-medical-expirations` (cron zilnic)
- Notificări email la expirare avize
- Export Excel rapoarte
- Calendar vizual programări
