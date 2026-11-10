import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import DashboardBanners from './DashboardBanners';
import { BentoGrid, BentoMain, BentoSide, SectionTitle } from './DashboardShell';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import DashboardGreeting from './DashboardGreeting';
import DashboardBulletinBoard from './DashboardBulletinBoard';
import QuickActionsGrid, { QuickAction } from './QuickActionsGrid';
import DashboardAnnouncements from './DashboardAnnouncements';
import ActivityHistory from './ActivityHistory';
import PersonalLeaveWidget from './PersonalLeaveWidget';
import ChangelogWidget from './ChangelogWidget';

import RoomBookingsWidget from './RoomBookingsWidget';
import SummaryStrip, { DaySummary } from './SummaryStrip';
import CustomizeDashboardSheet from './CustomizeDashboardSheet';
import { WidgetId, widgetById } from './dashboardWidgets';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  UserCircle, Calendar, FolderDown, FileText, Plane,
  Clock, CheckCircle2, XCircle, Inbox, SlidersHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { isHrRequestOwnedByUser } from '@/utils/leaveOwnership';

interface MyRequest {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const [{ data: profileData }, { data: recordData }, { data: hrData }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('employee_records').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('hr_requests').select('id, request_type, status, created_at, details')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ]);

    let ownEpdId: string | null = null;
    if (recordData?.id) {
      const { data: epdData } = await supabase.from('employee_personal_data')
        .select('id').eq('employee_record_id', recordData.id).maybeSingle();
      ownEpdId = epdData?.id ?? null;
    }

    const ownerFullName = profileData?.full_name ?? null;

    if (hrData) {
      const filtered = hrData
        .filter(hr => isHrRequestOwnedByUser({ details: hr.details, ownerEpdId: ownEpdId, ownerFullName }))
        .slice(0, 5)
        .map(hr => ({
          id: hr.id,
          type: hr.request_type,
          status: hr.status,
          createdAt: hr.created_at,
        }));
      setMyRequests(filtered);
    }
    setLoading(false);
  };

  const getRequestLabel = (type: string) => {
    const map: Record<string, string> = { concediu: 'Concediu', adeverinta: 'Adeverință', delegatie: 'Delegație', demisie: 'Demisie' };
    return map[type] || 'Cerere HR';
  };


  const pendingCount = myRequests.filter(r => !['approved', 'rejected'].includes(r.status)).length;

  const quickActions: QuickAction[] = [
    { icon: Plane, label: 'Cerere Concediu', path: '/leave-request', gradient: 'from-primary to-info', badge: pendingCount },
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile', gradient: 'from-accent to-success' },
    { icon: Calendar, label: 'Calendar', path: '/leave-calendar', gradient: 'from-info to-primary' },
    { icon: FolderDown, label: 'Formulare', path: '/formulare', gradient: 'from-warning to-accent' },
  ];

  const [customizing, setCustomizing] = useState(false);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const { layout, save, reset } = useDashboardLayout();
  const visible = layout.filter(i => i.visible).map(i => i.id);
  const top = visible.filter(id => widgetById(id).column === 'top');
  const main = visible.filter(id => widgetById(id).column === 'main');
  const side = visible.filter(id => widgetById(id).column === 'side');

  const daySummary = (() => {
    const parts: string[] = [];
    if (pendingCount > 0) parts.push(`${pendingCount} ${pendingCount === 1 ? 'cerere în lucru' : 'cereri în lucru'}`);
    if (summary?.roomsToday) parts.push(`${summary.roomsToday} ${summary.roomsToday === 1 ? 'rezervare de sală' : 'rezervări de săli'} azi`);
    if (summary?.leaveRemaining != null) parts.push(`sold concediu ${summary.leaveRemaining} zile`);
    return parts.length ? <>Azi: {parts.join(' · ')}</> : null;
  })();

  const requestsCard = (
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Inbox className="w-4 h-4 text-primary" />
                Cererile Mele
                {pendingCount > 0 && <Badge variant="destructive" className="ml-auto text-xs">{pendingCount}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
              ) : myRequests.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="Nicio cerere recentă"
                  description="Cererile tale de concediu sau adeverințe vor apărea aici."
                />
              ) : (
                <ScrollArea className={myRequests.length > 4 ? 'h-[200px]' : undefined}>
                  <div className="space-y-2">
                    {myRequests.map(req => (
                      <div key={req.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{getRequestLabel(req.type)}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(req.createdAt), 'd MMM yyyy', { locale: ro })}</p>
                        </div>
                        <StatusBadge status={req.status} />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

  );

  const render = (id: WidgetId) => {
    switch (id) {
      case 'bulletin': return <DashboardBulletinBoard />;
      case 'rooms': return <RoomBookingsWidget />;
      case 'announcements': return <DashboardAnnouncements />;
      case 'requests': return requestsCard;
      case 'activity': return <ActivityHistory />;
      case 'leave': return <PersonalLeaveWidget />;
      case 'changelog': return <ChangelogWidget />;
    }
  };

  return (
    <MainLayout title="Dashboard" description="Panoul tău personal">
      <DashboardBanners />
      <DashboardGreeting
        summary={daySummary}
        actions={
          <Button variant="outline" size="sm" className="rounded-full bg-card/60 backdrop-blur" onClick={() => setCustomizing(true)}>
            <SlidersHorizontal className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Personalizează</span>
          </Button>
        }
      />

      <div className="mt-4">
        <SummaryStrip pendingRequests={pendingCount} onSummary={setSummary} />
      </div>

      {top.map(id => <div key={id} className="mt-4">{render(id)}</div>)}

      <div className="mt-4">
        <SectionTitle>Acțiuni rapide <span className="normal-case tracking-normal font-normal text-muted-foreground/70">· sau apasă Ctrl+K</span></SectionTitle>
        <QuickActionsGrid actions={quickActions} columns={4} />
      </div>

      <BentoGrid className="mt-4">
        <BentoMain>{main.map(id => <div key={id}>{render(id)}</div>)}</BentoMain>
        <BentoSide>{side.map(id => <div key={id}>{render(id)}</div>)}</BentoSide>
      </BentoGrid>

      <CustomizeDashboardSheet open={customizing} onOpenChange={setCustomizing} layout={layout} onSave={save} onReset={reset} />
    </MainLayout>
  );
};

export default EmployeeDashboard;
