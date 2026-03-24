import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { Megaphone, ArrowRight, Pin, Paperclip, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

const priorityAccent: Record<string, string> = {
  low: 'border-l-muted-foreground/30',
  normal: 'border-l-primary',
  high: 'border-l-warning',
  urgent: 'border-l-destructive',
};

const DashboardAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

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
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center">
              <Megaphone className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            Anunțuri
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
              {announcements.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs h-7 px-2">
            <Link to="/announcements" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              Toate <ArrowRight className="w-3 h-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ScrollArea className="max-h-[280px]">
          <div className="space-y-1 px-2">
            {announcements.map((a) => {
              const isExpanded = expandedId === a.id;
              const isLong = a.content.length > 120;
              const displayContent = isExpanded || !isLong
                ? a.content
                : a.content.slice(0, 120) + '…';

              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 transition-all duration-200 group",
                    "hover:bg-accent/50 border-l-[3px]",
                    priorityAccent[a.priority],
                    isExpanded && "bg-accent/30",
                  )}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 min-w-0">
                    {a.is_pinned && <Pin className="w-3 h-3 text-primary fill-primary flex-shrink-0" />}
                    <span className="text-sm font-medium text-foreground truncate flex-1">
                      {a.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
                      {format(new Date(a.created_at), 'dd MMM', { locale: ro })}
                    </span>
                  </div>

                  {/* Content */}
                  <p className={cn(
                    "text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line",
                    !isExpanded && "line-clamp-2"
                  )}>
                    {displayContent}
                  </p>

                  {/* Meta indicators */}
                  {(a.attachments.length > 0 || a.links.length > 0) && (
                    <div className="flex gap-2 mt-1.5">
                      {a.attachments.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                          <Paperclip className="w-2.5 h-2.5" /> {a.attachments.length}
                        </span>
                      )}
                      {a.links.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                          <Link2 className="w-2.5 h-2.5" /> {a.links.length}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expand hint */}
                  {isLong && !isExpanded && (
                    <span className="text-[10px] text-primary/70 mt-1 inline-block group-hover:text-primary transition-colors">
                      citește mai mult
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default DashboardAnnouncements;
