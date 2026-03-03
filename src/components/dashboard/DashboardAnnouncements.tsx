import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Megaphone, ArrowRight } from 'lucide-react';
import AnnouncementCard from './AnnouncementCard';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_pinned: boolean;
  created_at: string;
  attachments: any[];
  links: any[];
}

const DashboardAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3);

      if (data) {
        setAnnouncements(data.map(a => ({
          ...a,
          priority: (a.priority as any) || 'normal',
          attachments: (a.attachments as any) || [],
          links: (a.links as any) || [],
        })));
      }
    };
    fetch();
  }, []);

  if (announcements.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="w-5 h-5 text-primary" />
            Anunțuri
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs">
            <Link to="/announcements" className="flex items-center gap-1">
              Toate <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {announcements.map((a) => (
          <AnnouncementCard
            key={a.id}
            title={a.title}
            content={a.content}
            priority={a.priority}
            isPinned={a.is_pinned}
            createdAt={a.created_at}
            attachments={a.attachments}
            links={a.links}
            compact
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default DashboardAnnouncements;
