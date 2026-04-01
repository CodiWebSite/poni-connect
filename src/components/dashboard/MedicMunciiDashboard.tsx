import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import DashboardAlertsBanner from './DashboardAlertsBanner';
import DashboardGreeting from './DashboardGreeting';
import QuickActionsGrid, { QuickAction } from './QuickActionsGrid';
import PendingActionsWidget, { PendingAction } from './PendingActionsWidget';
import StatCard from './StatCard';
import DashboardAnnouncements from './DashboardAnnouncements';
import ChangelogWidget from './ChangelogWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  HeartPulse, AlertTriangle, Clock, FileWarning, CalendarClock,
  Stethoscope, FolderOpen, Users,
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ExpiringRecord {
  id: string;
  employeeName: string;
  nextDate: string;
  daysUntil: number;
}

const MedicMunciiDashboard = () => {
  const [expired, setExpired] = useState<ExpiringRecord[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<ExpiringRecord[]>([]);
  const [totalDossiers, setTotalDossiers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch medical_dossier_data with next_consultation info from medical_consultations
    const { data: dossiers } = await supabase
      .from('medical_dossier_data')
      .select('id, epd_id');

    // Get employee names for these epd_ids
    const epdIds = (dossiers || []).map(d => d.epd_id);
    
    if (epdIds.length > 0) {
      const { data: employees } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name')
        .in('id', epdIds)
        .eq('is_archived', false);

      const nameMap: Record<string, string> = {};
      (employees || []).forEach(e => { nameMap[e.id] = `${e.last_name} ${e.first_name}`; });

      // Check medical_consultations for next_consultation_date
      const { data: consultations } = await supabase
        .from('medical_consultations')
        .select('medical_record_id, next_consultation_date')
        .not('next_consultation_date', 'is', null)
        .order('consultation_date', { ascending: false });

      const now = new Date();
      const expiredList: ExpiringRecord[] = [];
      const soonList: ExpiringRecord[] = [];

      // Group by medical_record_id, take latest
      const latestByRecord: Record<string, string> = {};
      (consultations || []).forEach(c => {
        if (!latestByRecord[c.medical_record_id]) {
          latestByRecord[c.medical_record_id] = c.next_consultation_date!;
        }
      });

      // We need to map medical_records to epd_ids
      const { data: medRecords } = await supabase
        .from('medical_records' as any)
        .select('id, epd_id')
        .in('id', Object.keys(latestByRecord));

      const recordToEpd: Record<string, string> = {};
      (medRecords || []).forEach((r: any) => { recordToEpd[r.id] = r.epd_id; });

      Object.entries(latestByRecord).forEach(([recId, nextDate]) => {
        const epdId = recordToEpd[recId];
        if (!epdId || !nameMap[epdId]) return;
        const days = differenceInDays(new Date(nextDate), now);
        const record: ExpiringRecord = {
          id: recId,
          employeeName: nameMap[epdId],
          nextDate,
          daysUntil: days,
        };
        if (days < 0) expiredList.push(record);
        else if (days <= 90) soonList.push(record);
      });

      setExpired(expiredList.sort((a, b) => a.daysUntil - b.daysUntil));
      setExpiringSoon(soonList.sort((a, b) => a.daysUntil - b.daysUntil));
    }

    setTotalDossiers((dossiers || []).length);
    setLoading(false);
  };

  const pendingActions: PendingAction[] = [
    { id: 'expired', icon: AlertTriangle, label: 'Fișe medicale expirate', count: expired.length, severity: 'critical', link: '/medicina-muncii' },
    { id: 'expiring', icon: CalendarClock, label: 'Expiră în 90 de zile', count: expiringSoon.length, severity: 'warning', link: '/medicina-muncii' },
  ];

  const quickActions: QuickAction[] = [
    { icon: Stethoscope, label: 'Medicina Muncii', path: '/medicina-muncii', gradient: 'from-primary to-info' },
    { icon: FolderOpen, label: 'Dosare Medicale', path: '/medicina-muncii', gradient: 'from-accent to-success' },
  ];

  return (
    <MainLayout title="Dashboard Medical" description="Medicina muncii — monitorizare fișe">
      <DashboardAlertsBanner />
      <DashboardGreeting subtitle="Monitorizare medicina muncii" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <PendingActionsWidget actions={pendingActions} loading={loading} />
        <StatCard title="Total Dosare Medicale" value={totalDossiers} icon={HeartPulse} iconClassName="from-destructive to-warning" />
      </div>

      {/* Expired details */}
      {expired.length > 0 && (
        <Card className="mt-4 border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Fișe Expirate
              <Badge variant="destructive" className="ml-auto">{expired.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className={expired.length > 5 ? 'h-[200px]' : undefined}>
              <div className="space-y-2">
                {expired.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.employeeName}</p>
                      <p className="text-xs text-muted-foreground">Expirat acum {Math.abs(r.daysUntil)} zile</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <DashboardAnnouncements />
        <ChangelogWidget />
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Acțiuni Rapide</h3>
        <QuickActionsGrid actions={quickActions} columns={2} />
      </div>
    </MainLayout>
  );
};

export default MedicMunciiDashboard;
