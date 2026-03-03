import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CalendarClock, CreditCard, Info, PauseCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { differenceInDays } from 'date-fns';

interface Alert {
  id: string;
  type: 'leave_limit' | 'ci_expiring' | 'contract_suspended';
  severity: 'warning' | 'critical' | 'info';
  employeeName: string;
  message: string;
}

const LEAVE_THRESHOLD = 3;
const CI_EXPIRY_DAYS = 90;

const HRAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const { data: employees } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, total_leave_days, used_leave_days, employee_record_id, ci_expiry_date')
      .eq('is_archived', false);

    const { data: records } = await supabase
      .from('employee_records')
      .select('id, total_leave_days, used_leave_days, user_id');

    // Fetch active non-deductible leaves (CFP, BO, CCC, EV) from hr_requests
    const today = new Date().toISOString().split('T')[0];
    const { data: activeHrLeaves } = await supabase
      .from('hr_requests')
      .select('user_id, details, request_type')
      .eq('request_type', 'concediu')
      .eq('status', 'approved');

    // Build a set of user_ids with active non-deductible leaves
    const suspendedUserIds = new Set<string>();
    const suspendedReasons: Record<string, string> = {};
    
    const leaveTypeLabels: Record<string, string> = {
      cfp: 'Concediu fără plată (CFP)',
      bo: 'Concediu medical (BO)',
      ccc: 'Concediu creștere copil (CCC)',
      ev: 'Eveniment deosebit (EV)',
    };

    (activeHrLeaves || []).forEach(hr => {
      const details = hr.details as any;
      const leaveType = details?.leaveType || details?.leave_type || '';
      if (['cfp', 'bo', 'ccc', 'ev'].includes(leaveType)) {
        const startDate = details?.startDate || details?.start_date || '';
        const endDate = details?.endDate || details?.end_date || '';
        // Check if the leave period covers today
        if (startDate && endDate && startDate <= today && endDate >= today) {
          suspendedUserIds.add(hr.user_id);
          suspendedReasons[hr.user_id] = leaveTypeLabels[leaveType] || leaveType;
        }
      }
    });

    // Map record id -> user_id
    const recordToUserId: Record<string, string> = {};
    const recordMap: Record<string, { total: number; used: number }> = {};
    (records || []).forEach(r => {
      recordMap[r.id] = { total: r.total_leave_days, used: r.used_leave_days };
      recordToUserId[r.id] = r.user_id;
    });

    const now = new Date();
    const result: Alert[] = [];

    (employees || []).forEach(e => {
      const name = `${e.last_name} ${e.first_name}`;
      const rec = e.employee_record_id ? recordMap[e.employee_record_id] : null;
      const userId = e.employee_record_id ? recordToUserId[e.employee_record_id] : null;
      const total = rec?.total ?? e.total_leave_days ?? 21;
      const used = rec?.used ?? e.used_leave_days ?? 0;
      const remaining = total - used;

      // Check if employee has an active non-deductible leave (suspended contract)
      if (userId && suspendedUserIds.has(userId)) {
        result.push({
          id: `suspended-${e.id}`,
          type: 'contract_suspended',
          severity: 'info',
          employeeName: name,
          message: suspendedReasons[userId] || 'Contract suspendat',
        });
        // Don't show leave limit alerts for suspended employees
      } else {
        // Leave limit alert (only for active employees)
        if (remaining <= 0) {
          result.push({
            id: `leave-${e.id}`,
            type: 'leave_limit',
            severity: 'critical',
            employeeName: name,
            message: `A epuizat toate zilele de concediu (${used}/${total})`,
          });
        } else if (remaining <= LEAVE_THRESHOLD) {
          result.push({
            id: `leave-${e.id}`,
            type: 'leave_limit',
            severity: 'warning',
            employeeName: name,
            message: `Mai are doar ${remaining} zile de concediu din ${total}`,
          });
        }
      }

      // CI expiry alert
      if (e.ci_expiry_date) {
        const expiryDate = new Date(e.ci_expiry_date);
        const daysUntilExpiry = differenceInDays(expiryDate, now);
        if (daysUntilExpiry < 0) {
          result.push({
            id: `ci-${e.id}`,
            type: 'ci_expiring',
            severity: 'critical',
            employeeName: name,
            message: `Cartea de identitate a expirat (de ${Math.abs(daysUntilExpiry)} zile)`,
          });
        } else if (daysUntilExpiry <= CI_EXPIRY_DAYS) {
          result.push({
            id: `ci-${e.id}`,
            type: 'ci_expiring',
            severity: 'warning',
            employeeName: name,
            message: `CI expiră în ${daysUntilExpiry} zile`,
          });
        }
      }
    });

    // Sort: critical first, then warnings, then info
    result.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
      return a.employeeName.localeCompare(b.employeeName);
    });

    setAlerts(result);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const criticalAndWarningCount = alerts.filter(a => a.severity !== 'info').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Alerte HR
          {criticalAndWarningCount > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {criticalAndWarningCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <Info className="w-4 h-4" />
            Totul este în regulă — nicio alertă.
          </div>
        ) : (
          <ScrollArea className="h-[220px]">
            <div className="space-y-2">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-sm ${
                    alert.severity === 'critical'
                      ? 'border-destructive/30 bg-destructive/5'
                      : alert.severity === 'warning'
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-primary/20 bg-primary/5'
                  }`}
                >
                  {alert.type === 'contract_suspended' ? (
                    <PauseCircle className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  ) : alert.type === 'leave_limit' ? (
                    <CalendarClock className={`w-4 h-4 mt-0.5 shrink-0 ${
                      alert.severity === 'critical' ? 'text-destructive' : 'text-yellow-600'
                    }`} />
                  ) : (
                    <CreditCard className={`w-4 h-4 mt-0.5 shrink-0 ${
                      alert.severity === 'critical' ? 'text-destructive' : 'text-yellow-600'
                    }`} />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{alert.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default HRAlerts;
