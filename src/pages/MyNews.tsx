import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Sparkles, FileText, CalendarClock, Inbox, CheckCheck, BellRing, ArrowRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ro } from 'date-fns/locale';

const STORAGE_KEY = 'icmpp_news_last_seen';

interface NewsItem {
  id: string;
  title: string;
  subtitle?: string | null;
  date: string;
  link: string;
  group: 'announcement' | 'changelog' | 'document' | 'meeting' | 'request';
}

const GROUPS: Record<NewsItem['group'], { label: string; icon: React.ElementType }> = {
  announcement: { label: 'Anunțuri', icon: Megaphone },
  changelog: { label: 'Noutăți în platformă', icon: Sparkles },
  document: { label: 'Documente noi', icon: FileText },
  meeting: { label: 'Ședințe apropiate', icon: CalendarClock },
  request: { label: 'Cererile mele', icon: Inbox },
};

const statusLabel = (status: string | null) => {
  switch (status) {
    case 'approved':
    case 'completed': return 'Aprobată';
    case 'rejected': return 'Respinsă';
    case 'in_progress': return 'În lucru';
    case 'pending': return 'În așteptare';
    default: return status || '—';
  }
};

const MyNews = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [since, setSince] = useState<Date>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Date(stored) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const sinceIso = since.toISOString();
    const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [announcements, changelog, documents, meetings, leave, hr, notifications] = await Promise.all([
      supabase.from('announcements').select('id, title, created_at, priority').gte('created_at', sinceIso).order('created_at', { ascending: false }).limit(15),
      supabase.from('changelog_entries').select('id, title, description, created_at, version').gte('created_at', sinceIso).order('created_at', { ascending: false }).limit(10),
      supabase.from('archive_documents').select('id, file_name, department, created_at').gte('created_at', sinceIso).order('created_at', { ascending: false }).limit(10),
      supabase.from('meetings').select('id, title, start_at, location').gte('start_at', new Date().toISOString()).lte('start_at', inSevenDays).order('start_at').limit(10),
      supabase.from('leave_requests').select('id, request_number, status, updated_at').eq('user_id', user.id).gte('updated_at', sinceIso).order('updated_at', { ascending: false }).limit(10),
      supabase.from('hr_requests').select('id, request_type, status, updated_at').eq('user_id', user.id).gte('updated_at', sinceIso).order('updated_at', { ascending: false }).limit(10),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
    ]);

    const collected: NewsItem[] = [
      ...(announcements.data || []).map((a) => ({
        id: `ann-${a.id}`, title: a.title, subtitle: a.priority === 'high' ? 'Prioritate ridicată' : null,
        date: a.created_at, link: '/anunturi', group: 'announcement' as const,
      })),
      ...(changelog.data || []).map((c) => ({
        id: `chg-${c.id}`, title: c.title, subtitle: c.version ? `Versiunea ${c.version}` : c.description,
        date: c.created_at, link: '/changelog', group: 'changelog' as const,
      })),
      ...(documents.data || []).map((d) => ({
        id: `doc-${d.id}`, title: d.file_name, subtitle: d.department,
        date: d.created_at, link: '/arhiva', group: 'document' as const,
      })),
      ...(meetings.data || []).map((m) => ({
        id: `mtg-${m.id}`, title: m.title, subtitle: m.location,
        date: m.start_at, link: '/sedinte', group: 'meeting' as const,
      })),
      ...(leave.data || []).map((l) => ({
        id: `lv-${l.id}`, title: `Cererea de concediu ${l.request_number || ''}`.trim(),
        subtitle: statusLabel(l.status), date: l.updated_at, link: '/concedii', group: 'request' as const,
      })),
      ...(hr.data || []).map((h) => ({
        id: `hr-${h.id}`, title: 'Solicitare resurse umane',
        subtitle: statusLabel(h.status), date: h.updated_at, link: '/hr-requests', group: 'request' as const,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setItems(collected);
    setUnread(notifications.count ?? 0);
    setLoading(false);
  }, [user, since]);

  useEffect(() => { load(); }, [load]);

  const markAllSeen = () => {
    const stamp = new Date();
    localStorage.setItem(STORAGE_KEY, stamp.toISOString());
    setSince(stamp);
  };

  const groups = (Object.keys(GROUPS) as NewsItem['group'][])
    .map((key) => ({ key, ...GROUPS[key], entries: items.filter((i) => i.group === key) }))
    .filter((g) => g.entries.length > 0);

  return (
    <MainLayout title="Noutăți pentru mine">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellRing className="h-5 w-5 text-primary" />
                Ce s-a schimbat de la ultima ta vizită
              </CardTitle>
              <CardDescription>
                Din {format(since, 'd MMMM yyyy, HH:mm', { locale: ro })} — {items.length} noutăți
                {unread > 0 && ` · ${unread} notificări necitite`}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={markAllSeen} className="gap-2">
              <CheckCheck className="h-4 w-4" />
              Am văzut tot
            </Button>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <CheckCheck className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">Ești la zi</p>
              <p className="text-sm text-muted-foreground">Nu a apărut nimic nou de la ultima ta vizită.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((group) => {
              const Icon = group.icon;
              return (
                <Card key={group.key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4 text-primary" />
                      {group.label}
                      <Badge variant="secondary">{group.entries.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {group.entries.map((entry) => (
                      <Link
                        key={entry.id}
                        to={entry.link}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {entry.subtitle ? `${entry.subtitle} · ` : ''}
                            {formatDistanceToNow(new Date(entry.date), { addSuffix: true, locale: ro })}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MyNews;
