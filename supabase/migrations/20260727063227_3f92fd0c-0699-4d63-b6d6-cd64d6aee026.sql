
INSERT INTO public.announcements (title, content, author_id, priority, is_pinned)
VALUES (
  '📄 Fluturașii de salariu, disponibili online pentru toți angajații',
  E'Începând de astăzi, secțiunea **„Fluturașii mei"** este activă pentru toți angajații ICMPP direct în profilul dvs. de pe intranet.\n\n**Cum accesați:**\n1. Deschideți meniul din dreapta sus și intrați la **Profilul meu**.\n2. Derulați până la cardul **„Fluturașii mei"**.\n3. Apăsați **Descarcă** pentru luna dorită.\n\n**Securitate:** fișierele PDF sunt criptate. **Parola = ultimele 6 cifre din CNP-ul dvs.** Introduceți-o când cititorul PDF vă solicită la deschidere.\n\n**Dacă ceva nu corespunde** (sume greșite, alt angajat, spor lipsă), apăsați butonul **„Semnalează"** de lângă fluturaș — descrieți problema și echipa Salarizare va înlocui documentul.\n\nDistribuția lunară se face automat imediat ce Salarizarea încarcă centralizatorul. Vă mulțumim!',
  'd36e9878-4f59-409a-b206-7a4d40831e6a',
  'high',
  true
);

INSERT INTO public.changelog_entries (version, title, description, target_roles, impact_level, module, action_url, action_label, created_by)
VALUES
  ('4.2.0', 'Fluturași de salariu online — Live pentru toți angajații',
   'Secțiunea „Fluturașii mei" este activată pentru toți angajații ICMPP. Fiecare salariat își vede propriul istoric de fluturași direct în profil, cu PDF-uri criptate (parolă = ultimele 6 cifre din CNP). Faza pilot s-a încheiat cu succes.',
   ARRAY['*']::text[], 'major', 'Salarizare', '/my-profile', 'Vezi fluturașii mei',
   'd36e9878-4f59-409a-b206-7a4d40831e6a'),
  ('4.1.0', 'Sesizări pentru fluturași incorecți',
   'Buton „Semnalează" pe fiecare fluturaș din profil. Angajatul descrie problema, Salarizarea primește notificare automată și poate rezolva sesizarea din panoul dedicat.',
   ARRAY['*']::text[], 'minor', 'Salarizare', '/my-profile', NULL,
   'd36e9878-4f59-409a-b206-7a4d40831e6a'),
  ('4.0.5', 'Previzualizare necriptată pentru Salarizare',
   'Rolurile Salarizare și Super-admin pot previzualiza fluturașii încărcați fără parolă. Criptarea AES-256 se aplică automat la distribuția către angajați.',
   ARRAY['salarizare','super_admin']::text[], 'minor', 'Salarizare', NULL, NULL,
   'd36e9878-4f59-409a-b206-7a4d40831e6a'),
  ('4.0.4', 'Audit complet pe fluturași',
   'Panou nou de audit vizibil pentru Super-admin cu filtre pe acțiuni (descărcare, distribuție, re-procesare, ștergere lot), căutare după utilizator și export CSV.',
   ARRAY['super_admin']::text[], 'minor', 'Salarizare', NULL, NULL,
   'd36e9878-4f59-409a-b206-7a4d40831e6a'),
  ('4.0.3', 'Re-procesare lot fluturași',
   'Acțiune „Re-procesează lot" care regenerează doar fluturașii cu fișier lipsă, fără să afecteze restul lotului.',
   ARRAY['salarizare','super_admin']::text[], 'fix', 'Salarizare', NULL, NULL,
   'd36e9878-4f59-409a-b206-7a4d40831e6a');
