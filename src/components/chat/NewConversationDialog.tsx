import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { formatNumePrenume } from '@/utils/formatName';
import { cn } from '@/lib/utils';

interface UserItem {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  is_online: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

const NewConversationDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    setSearch('');

    const fetchUsers = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, department')
        .neq('user_id', user.id)
        .order('full_name');

      // Fetch online status - user_presence has restrictive RLS, so use a simpler approach
      // We'll check presence for each user via the threshold approach
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: onlineUsers } = await supabase
        .from('user_presence')
        .select('user_id')
        .eq('is_online', true)
        .gte('last_seen_at', fiveMinAgo);

      const onlineSet = new Set((onlineUsers || []).map(u => u.user_id));

      const mapped = (profiles || []).map(u => ({
        ...u,
        full_name: formatNumePrenume({ fullName: u.full_name }),
        is_online: onlineSet.has(u.user_id),
      }));

      setUsers(mapped);
      const depts = new Set(mapped.map(u => u.department || 'Fără departament'));
      setExpandedDepts(depts);
    };

    fetchUsers();
  }, [open, user]);

  const filtered = useMemo(() =>
    users.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(search.toLowerCase())
    ),
    [users, search]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, UserItem[]>();
    for (const u of filtered) {
      const dept = u.department || 'Fără departament';
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(u);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Fără departament') return 1;
      if (b === 'Fără departament') return -1;
      return a.localeCompare(b, 'ro');
    });
  }, [filtered]);

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const handleSelect = async (targetUserId: string) => {
    if (!user || creating) return;
    setCreating(true);

    try {
      // Check if direct conversation already exists
      const { data: myConvs } = await supabase
        .from('chat_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (myConvs?.length) {
        const convIds = myConvs.map(c => c.conversation_id);
        const { data: existing } = await supabase
          .from('chat_participants')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', convIds);

        if (existing?.length) {
          for (const ex of existing) {
            const { data: conv } = await supabase
              .from('chat_conversations')
              .select('id, type')
              .eq('id', ex.conversation_id)
              .eq('type', 'direct')
              .maybeSingle();
            if (conv) {
              onCreated(conv.id);
              return;
            }
          }
        }
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('chat_conversations')
        .insert({ type: 'direct', created_by: user.id })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        return;
      }

      if (newConv) {
        // Insert creator first, then the other participant
        const { error: p1Error } = await supabase
          .from('chat_participants')
          .insert({ conversation_id: newConv.id, user_id: user.id });

        if (p1Error) {
          console.error('Error adding self as participant:', p1Error);
          return;
        }

        const { error: p2Error } = await supabase
          .from('chat_participants')
          .insert({ conversation_id: newConv.id, user_id: targetUserId });

        if (p2Error) {
          console.error('Error adding other participant:', p2Error);
          return;
        }

        onCreated(newConv.id);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conversație nouă</DialogTitle>
        </DialogHeader>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută coleg sau departament..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-1">
            {grouped.map(([dept, deptUsers]) => {
              const isExpanded = expandedDepts.has(dept);
              const onlineCount = deptUsers.filter(u => u.is_online).length;
              return (
                <div key={dept}>
                  <button
                    onClick={() => toggleDept(dept)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <Building2 className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide flex-1 text-left truncate">
                      {dept}
                    </span>
                    {onlineCount > 0 && (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                        {onlineCount} online
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {deptUsers.length}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 space-y-0.5">
                      {deptUsers.map(u => (
                        <button
                          key={u.user_id}
                          onClick={() => handleSelect(u.user_id)}
                          disabled={creating}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left",
                            creating && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                              <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                                {u.full_name.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            {/* Online indicator dot */}
                            <span
                              className={cn(
                                "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
                                u.is_online ? "bg-green-500" : "bg-muted-foreground/30"
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.full_name}</p>
                            <p className={cn(
                              "text-[11px]",
                              u.is_online ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                            )}>
                              {u.is_online ? 'Online' : 'Offline'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {grouped.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Niciun rezultat</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationDialog;
