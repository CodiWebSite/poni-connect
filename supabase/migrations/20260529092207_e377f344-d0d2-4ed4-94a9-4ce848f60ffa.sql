DROP TABLE IF EXISTS public.registry_orphan_storage CASCADE;
DROP TABLE IF EXISTS public.registry_pin_state CASCADE;
DROP TABLE IF EXISTS public.registry_attachments CASCADE;
DROP TABLE IF EXISTS public.registry_entries CASCADE;
DROP TABLE IF EXISTS public.registry_requests CASCADE;
DROP TABLE IF EXISTS public.registry_counters CASCADE;
DROP TABLE IF EXISTS public.registry_department_operators CASCADE;
DROP TABLE IF EXISTS public.registry_department_settings CASCADE;

DROP SEQUENCE IF EXISTS public.registry_temp_code_seq CASCADE;

DROP FUNCTION IF EXISTS public.can_manage_registry(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_registry_operator(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_registry_dept_key(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.secretariat_restricted_queue() CASCADE;
DROP FUNCTION IF EXISTS public.approve_registry_request_restricted(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.reject_registry_request(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.verify_counter_integrity(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.rotate_department_pin(text, text) CASCADE;
DROP FUNCTION IF EXISTS public._allocate_official_number(text, integer, boolean) CASCADE;
DROP FUNCTION IF EXISTS public._register_attachment_verified(uuid, text, text, text, bigint, uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public._delete_attachment_verified(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public._verify_registry_pin(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public._report_orphan_storage(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.registry_entries_protect_official_fields() CASCADE;

DROP TYPE IF EXISTS public.registry_entry_status CASCADE;
DROP TYPE IF EXISTS public.registry_entry_type CASCADE;
DROP TYPE IF EXISTS public.registry_request_status CASCADE;
DROP TYPE IF EXISTS public.registry_confidentiality CASCADE;