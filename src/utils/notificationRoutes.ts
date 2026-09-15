interface NotificationRouteInput {
  related_type: string | null;
  related_id: string | null;
}

export function getNotificationRoute(notification: NotificationRouteInput): string {
  const { related_type: type, related_id: id } = notification;

  switch (type) {
    case 'payslip':
      return '/my-profile';
    case 'payslip_issue_report':
      return '/salarizare';
    case 'leave_request':
    case 'leave_approval':
      return id ? `/leave-request?request=${id}` : '/leave-request';
    case 'hr_request':
    case 'data_correction':
      return '/hr-management';
    case 'meeting_reminder_log':
    case 'meeting':
      return '/agenda-intalniri';
    case 'medical_record':
      return '/medicina-muncii';
    case 'security_event':
    case 'auth_login':
      return '/securitatea-mea';
    case 'social_post':
      return id ? `/social?post=${id}` : '/social';
    case 'announcement':
      return id ? `/announcements?id=${id}` : '/announcements';
    case 'helpdesk_ticket':
      return id ? `/admin?tab=helpdesk&ticket=${id}` : '/admin?tab=helpdesk';
    case 'account_request':
      return '/admin?tab=conturi';
    case 'suggestion':
      return id ? `/sugestii?id=${id}` : '/sugestii';
    case 'incident_report':
      return '/admin?tab=security-incidents';
    case 'gdpr_request':
      return '/admin?tab=gdpr';
    case 'system_alert':
      return '/system-status';
    default:
      return '/';
  }
}