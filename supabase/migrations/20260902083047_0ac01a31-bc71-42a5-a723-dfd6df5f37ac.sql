DO $$
DECLARE
  f record;
  policy_helpers text[] := ARRAY[
    'archive_same_department','can_manage_communities','can_manage_content','can_manage_hr',
    'can_manage_library','can_manage_medical','can_manage_meetings','can_manage_salarizare',
    'can_publish_announcements','can_publish_events','can_view_medical_status',
    'epd_same_department','get_user_department','has_role','is_activity_organizer',
    'is_chat_participant','is_chat_conversation_creator','is_community_admin','is_community_member',
    'is_community_moderator','is_gdpr_officer','is_leave_approver_for_epd','is_leave_approver_for_request',
    'storage_archive_department_match','user_same_department','can_view_restricted_management',
    'can_view_sensitive_profile_data','get_user_role','social_setting_enabled','is_ip_bypass_user',
    'is_payslip_pilot_user','is_demo_user'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND pg_get_function_result(p.oid) <> 'trigger'
      AND p.proname = ANY(policy_helpers)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', f.sig);
  END LOOP;
END $$;