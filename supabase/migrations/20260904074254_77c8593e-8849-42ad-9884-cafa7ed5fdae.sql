-- Secretar stiintific: Mihai Marcela -> Dascalu Mihaela
UPDATE public.leave_approvers
SET approver_user_id = '92276033-a0ad-498c-8305-429399b4b046',
    approver_email = 'amihaela@icmpp.ro'
WHERE approver_user_id = '9ad43f2b-f531-4d80-a8b3-2fc0490352be'
  AND employee_user_id <> '92276033-a0ad-498c-8305-429399b4b046';

-- Director adjunct: Airinei Anton -> Samoila Petrisor
UPDATE public.leave_approvers
SET approver_user_id = '2babce60-d010-4036-8332-ee4a57dee7e5',
    approver_email = 'samoila.petrisor@icmpp.ro'
WHERE approver_user_id = '96ff594f-5d6a-4f4e-9137-9f1067c355d1'
  AND employee_user_id <> '2babce60-d010-4036-8332-ee4a57dee7e5';

-- Delegarea directoarei: Airinei -> Samoila
UPDATE public.leave_approval_delegates
SET delegate_user_id = '2babce60-d010-4036-8332-ee4a57dee7e5',
    reason = 'Concediu de odihna director - delegare aprobare catre Petrisor Samoila (director adjunct)'
WHERE id = '6b15cf19-709f-4edf-8c27-68d6930d4b89';