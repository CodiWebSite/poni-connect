import { supabase } from '@/integrations/supabase/client';

export interface ApproverScope {
  /** Toate departamentele pe care utilizatorul le are în subordine (inclusiv al său) */
  departments: string[];
  /** Angajați desemnați individual (user_id) pentru care este aprobator */
  employeeUserIds: string[];
}

/**
 * Determină întregul perimetru de subordine al unui aprobator:
 * - departamentul propriu (din profil)
 * - toate departamentele din `leave_department_approvers`
 * - departamentele preluate prin delegare activă
 * - angajații desemnați individual în `leave_approvers`
 */
export async function fetchApproverScope(userId: string): Promise<ApproverScope> {
  const departments = new Set<string>();
  const employeeUserIds = new Set<string>();

  const [profileRes, deptRes, indivRes, delegRes] = await Promise.all([
    supabase.from('profiles').select('department').eq('user_id', userId).maybeSingle(),
    supabase.from('leave_department_approvers').select('department').eq('approver_user_id', userId),
    supabase.from('leave_approvers').select('employee_user_id').eq('approver_user_id', userId),
    supabase
      .from('leave_approval_delegates')
      .select('delegator_user_id')
      .eq('delegate_user_id', userId)
      .eq('is_active', true)
      .lte('start_date', new Date().toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0]),
  ]);

  if (profileRes.data?.department) departments.add(profileRes.data.department);
  (deptRes.data || []).forEach((d: any) => d.department && departments.add(d.department));
  (indivRes.data || []).forEach((d: any) => d.employee_user_id && employeeUserIds.add(d.employee_user_id));

  const delegatorIds = [...new Set((delegRes.data || []).map((d: any) => d.delegator_user_id).filter(Boolean))];
  if (delegatorIds.length > 0) {
    const [delegDepts, delegIndiv] = await Promise.all([
      supabase.from('leave_department_approvers').select('department').in('approver_user_id', delegatorIds),
      supabase.from('leave_approvers').select('employee_user_id').in('approver_user_id', delegatorIds),
    ]);
    (delegDepts.data || []).forEach((d: any) => d.department && departments.add(d.department));
    (delegIndiv.data || []).forEach((d: any) => d.employee_user_id && employeeUserIds.add(d.employee_user_id));
  }

  return { departments: [...departments], employeeUserIds: [...employeeUserIds] };
}
