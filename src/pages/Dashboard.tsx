import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import StatCard from '@/components/dashboard/StatCard';
import AnnouncementCard from '@/components/dashboard/AnnouncementCard';
import QuickLinks from '@/components/dashboard/QuickLinks';
import UpcomingEvents from '@/components/dashboard/UpcomingEvents';
import BirthdayWidget from '@/components/dashboard/BirthdayWidget';
import { supabase } from '@/integrations/supabase/client';
import { Users, Megaphone, FileText, Calendar } from 'lucide-react';
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState({
    employees: 0,
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
    const [profilesCount, announcementsCount, documentsCount, eventsCount] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('announcements').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
    ]);

    setStats({
      employees: profilesCount.count || 0,
      announcements: announcementsCount.count || 0,
      documents: documentsCount.count || 0,
      events: eventsCount.count || 0,
    });
  };

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
          <BirthdayWidget />
          <QuickLinks />
          <UpcomingEvents events={events} />
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
