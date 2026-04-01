import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import DashboardAlertsBanner from './DashboardAlertsBanner';
import DashboardGreeting from './DashboardGreeting';
import QuickActionsGrid, { QuickAction } from './QuickActionsGrid';
import DashboardAnnouncements from './DashboardAnnouncements';
import ActivityHistory from './ActivityHistory';
import PersonalLeaveWidget from './PersonalLeaveWidget';
import ChangelogWidget from './ChangelogWidget';
import InstallAppBanner from './InstallAppBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  UserCircle, Calendar, FolderDown, FileText, Plane,
  Clock, CheckCircle2, XCircle, Inbox,
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

  const getStatusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-success/10 text-success border-success/20 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />Aprobat</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="text-[10px]"><XCircle className="w-2.5 h-2.5 mr-0.5" />Respins</Badge>;
    return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 text-[10px]"><Clock className="w-2.5 h-2.5 mr-0.5" />În așteptare</Badge>;
  };

  const pendingCount = myRequests.filter(r => !['approved', 'rejected'].includes(r.status)).length;

  const quickActions: QuickAction[] = [
    { icon: Plane, label: 'Cerere Concediu', path: '/leave-request', gradient: 'from-primary to-info', badge: pendingCount },
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile', gradient: 'from-accent to-success' },
    { icon: Calendar, label: 'Calendar', path: '/leave-calendar', gradient: 'from-info to-primary' },
    { icon: FolderDown, label: 'Formulare', path: '/formulare', gradient: 'from-warning to-accent' },
  ];

  return (
    <MainLayout title="Dashboard" description="Panoul tău personal">
      <InstallAppBanner />
      <DashboardAlertsBanner />
      <DashboardGreeting subtitle="Iată un rezumat al situației tale." />

      {/* Announcements */}
      <div className="mt-4">
        <DashboardAnnouncements />
      </div>

      {/* My Requests + Leave */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Card>
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
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-success/60" />
                  <p className="text-sm">Nicio cerere recentă</p>
                </div>
              ) : (
                <ScrollArea className={myRequests.length > 4 ? 'h-[200px]' : undefined}>
                  <div className="space-y-2">
                    {myRequests.map(req => (
                      <div key={req.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{getRequestLabel(req.type)}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(req.createdAt), 'd MMM yyyy', { locale: ro })}</p>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
        <PersonalLeaveWidget />
      </div>

      {/* Quick Actions */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Acțiuni Rapide</h3>
        <QuickActionsGrid actions={quickActions} columns={4} />
      </div>

      {/* Activity + Changelog */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <ActivityHistory />
        <ChangelogWidget />
      </div>
    </MainLayout>
  );
};

export default EmployeeDashboard;
