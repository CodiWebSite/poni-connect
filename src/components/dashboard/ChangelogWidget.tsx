import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Newspaper, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string;
  target_roles: string[];
  impact_level: string;
  module: string | null;
  action_url: string | null;
  action_label: string | null;
  created_at: string;
}

const impactColors: Record<string, string> = {
  major: 'bg-primary/10 text-primary border-primary/30',
  minor: 'bg-muted text-muted-foreground border-muted',
  fix: 'bg-green-500/10 text-green-700 border-green-500/30',
};

const ChangelogWidget = () => {
  const { role } = useUserRole();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChangelog();
  }, [role]);

  const fetchChangelog = async () => {
    const { data } = await supabase
      .from('changelog_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .order('version', { ascending: false })
      .limit(20);

    if (data) {
      // Filter by role: show if target_roles is empty (for everyone) or includes user's role
      const filtered = (data as ChangelogEntry[]).filter(e =>
        !e.target_roles ||
        e.target_roles.length === 0 ||
        e.target_roles.includes('*') ||
        (role && e.target_roles.includes(role))
      );
      setEntries(filtered.slice(0, 3));
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/25 shadow-sm">
      <div className="h-1 bg-primary" aria-hidden="true" />
      <CardHeader className="border-b border-primary/10 bg-primary/5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Newspaper className="w-4 h-4 text-primary" />
            </span>
            Noutăți în platformă
          </CardTitle>
          {role === 'super_admin' && (
            <Button variant="ghost" size="sm" asChild className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground">
              <Link to="/changelog">
                Vezi tot <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nu există noutăți momentan.</p>
        ) : (
          <ScrollArea className="max-h-[330px] pr-2">
            <div className="divide-y divide-border">
              {entries.map((entry) => {
                const isRecent = Date.now() - new Date(entry.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
                return (
                  <div
                    key={entry.id}
                    className="relative py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={impactColors[entry.impact_level] || impactColors.minor}>
                          v{entry.version}
                        </Badge>
                        {entry.module && (
                          <span className="text-xs text-muted-foreground">{entry.module}</span>
                        )}
                        {isRecent && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> NOU
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.created_at), 'd MMM', { locale: ro })}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium mb-0.5">{entry.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{entry.description}</p>
                    {entry.action_url && entry.action_label && (
                      <Button variant="link" size="sm" asChild className="h-auto p-0 mt-1 text-xs">
                        <Link to={entry.action_url}>
                          {entry.action_label} <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ChangelogWidget;
