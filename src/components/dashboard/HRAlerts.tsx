import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CalendarClock, CreditCard, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { differenceInDays, parse, isValid, addYears } from 'date-fns';

interface Alert {
  id: string;
  type: 'leave_limit' | 'ci_expiring';
  severity: 'warning' | 'critical';
  employeeName: string;
  message: string;
}

// Romanian CI validity based on age (from CNP birth year)
function getCIExpiryDate(ciIssuedDate: string, cnp: string): Date | null {
  if (!ciIssuedDate) return null;
  const issued = new Date(ciIssuedDate);
  if (!isValid(issued)) return null;

  // Extract birth year from CNP
  const s = cnp.charAt(0);
  const yy = parseInt(cnp.substring(1, 3));
  let birthYear: number;
  if (s === '1' || s === '2') birthYear = 1900 + yy;
  else if (s === '5' || s === '6') birthYear = 2000 + yy;
  else birthYear = 1900 + yy;

  const birthMonth = parseInt(cnp.substring(3, 5));
  const birthDay = parseInt(cnp.substring(5, 7));
  const birthDate = new Date(birthYear, birthMonth - 1, birthDay);

  // Age at CI issue
  const ageAtIssue = differenceInDays(issued, birthDate) / 365.25;

  // Validity periods by age
  let validityYears: number;
  if (ageAtIssue < 14) validityYears = 4;
  else if (ageAtIssue < 18) validityYears = 4;
  else if (ageAtIssue < 25) validityYears = 7;
  else validityYears = 10;

  return addYears(issued, validityYears);
}

const LEAVE_THRESHOLD = 3; // alert when remaining <= 3 days
const CI_EXPIRY_DAYS = 90; // alert 90 days before CI expiry

const HRAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const { data: employees } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, total_leave_days, used_leave_days, employee_record_id, ci_issued_date, cnp')
      .eq('is_archived', false);

    const { data: records } = await supabase
      .from('employee_records')
      .select('id, total_leave_days, used_leave_days');

    const recordMap: Record<string, { total: number; used: number }> = {};
    (records || []).forEach(r => {
      recordMap[r.id] = { total: r.total_leave_days, used: r.used_leave_days };
    });

    const now = new Date();
    const result: Alert[] = [];

    (employees || []).forEach(e => {
      const name = `${e.last_name} ${e.first_name}`;
      const rec = e.employee_record_id ? recordMap[e.employee_record_id] : null;
      const total = rec?.total ?? e.total_leave_days ?? 21;
      const used = rec?.used ?? e.used_leave_days ?? 0;
      const remaining = total - used;

      // Leave limit alert
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

      // CI expiry alert
      if (e.ci_issued_date && e.cnp) {
        const expiryDate = getCIExpiryDate(e.ci_issued_date, e.cnp);
        if (expiryDate) {
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
      }
    });

    // Sort: critical first
    result.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Alerte HR
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {alerts.length}
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
                      : 'border-yellow-500/30 bg-yellow-500/5'
                  }`}
                >
                  {alert.type === 'leave_limit' ? (
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
