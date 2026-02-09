import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import MainLayout from '@/components/layout/MainLayout';
import StatCard from '@/components/dashboard/StatCard';
import AnnouncementCard from '@/components/dashboard/AnnouncementCard';
import PersonalCalendarWidget from '@/components/dashboard/PersonalCalendarWidget';
import QuickLinks from '@/components/dashboard/QuickLinks';
import UpcomingEvents from '@/components/dashboard/UpcomingEvents';
import WeatherWidget from '@/components/dashboard/WeatherWidget';
import { Progress } from '@/components/ui/progress';
import ActivityHistory from '@/components/dashboard/ActivityHistory';
import ActivationChart from '@/components/dashboard/ActivationChart';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Users, Megaphone, FileText, Calendar, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_pinned: boolean;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  location?: string;
}

const Dashboard = () => {
  const { role, loading: roleLoading } = useUserRole();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState({
    employees: 0,
    employeesWithAccount: 0,
    announcements: 0,
    documents: 0,
    events: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch announcements
    const { data: announcementsData } = await supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(4);

    if (announcementsData) {
      setAnnouncements(announcementsData as Announcement[]);
    }

    // Fetch events
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(4);

    if (eventsData) {
      setEvents(eventsData.map(e => ({
        id: e.id,
        title: e.title,
        startDate: e.start_date,
        location: e.location || undefined,
      })));
    }

    // Fetch counts
    const [employeesCount, employeesWithAccountCount, announcementsCount, documentsCount, eventsCount] = await Promise.all([
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }),
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).not('employee_record_id', 'is', null),
      supabase.from('announcements').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
    ]);

    setStats({
      employees: employeesCount.count || 0,
      employeesWithAccount: employeesWithAccountCount.count || 0,
      announcements: announcementsCount.count || 0,
      documents: documentsCount.count || 0,
      events: eventsCount.count || 0,
    });
  };

  // Show simplified dashboard for regular employees
  if (role === 'user') {
    return (
      <MainLayout title="Dashboard" description="Bine ați venit în intranetul ICMPP">
        <EmployeeDashboard />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard" description="Bine ați venit în intranetul ICMPP">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Angajați"
          value={stats.employees}
          icon={Users}
          iconClassName="bg-primary"
        />
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex gap-4 w-full">
            <div className="flex items-center gap-2 flex-1">
              <UserCheck className="w-5 h-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{stats.employeesWithAccount}</p>
                <p className="text-xs text-muted-foreground">Cu cont</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <UserX className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{stats.employees - stats.employeesWithAccount}</p>
                <p className="text-xs text-muted-foreground">Fără cont</p>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Activare conturi</span>
              <span className="font-medium text-foreground">
                {stats.employees > 0 ? Math.round((stats.employeesWithAccount / stats.employees) * 100) : 0}%
              </span>
            </div>
            <Progress 
              value={stats.employees > 0 ? (stats.employeesWithAccount / stats.employees) * 100 : 0} 
              className={`h-2 ${
                stats.employees > 0
                  ? (stats.employeesWithAccount / stats.employees) * 100 >= 75
                    ? '[&>div]:bg-green-500'
                    : (stats.employeesWithAccount / stats.employees) * 100 >= 50
                      ? '[&>div]:bg-yellow-500'
                      : (stats.employeesWithAccount / stats.employees) * 100 >= 25
                        ? '[&>div]:bg-orange-500'
                        : '[&>div]:bg-red-500'
                  : ''
              }`}
            />
          </div>
        </Card>
        <StatCard
          title="Anunțuri"
          value={stats.announcements}
          icon={Megaphone}
          iconClassName="bg-accent"
        />
        <StatCard
          title="Documente"
          value={stats.documents}
          icon={FileText}
          iconClassName="bg-info"
        />
        <StatCard
          title="Evenimente"
          value={stats.events}
          icon={Calendar}
          iconClassName="bg-success"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Announcements */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold text-foreground">Anunțuri recente</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/announcements" className="flex items-center gap-1">
                Vezi toate <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
          
          {announcements.length === 0 ? (
            <div className="bg-card rounded-xl p-8 border border-border text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nu există anunțuri încă</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {announcements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  title={announcement.title}
                  content={announcement.content}
                  priority={announcement.priority as 'low' | 'normal' | 'high' | 'urgent'}
                  isPinned={announcement.is_pinned}
                  createdAt={announcement.created_at}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <ActivationChart />
          <PersonalCalendarWidget />
          <WeatherWidget />
          <ActivityHistory />
          <QuickLinks />
          <UpcomingEvents events={events} />
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
