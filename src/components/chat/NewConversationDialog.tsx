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
    supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, department')
      .neq('user_id', user.id)
      .order('full_name')
      .then(({ data }) => {
        setUsers(
          (data || []).map(u => ({
            ...u,
            full_name: formatNumePrenume({ fullName: u.full_name }),
          }))
        );
        // Expand all departments by default
        const depts = new Set((data || []).map(u => u.department || 'Fără departament'));
        setExpandedDepts(depts);
      });
  }, [open, user]);

  const filtered = useMemo(() => 
    users.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(search.toLowerCase())
    ),
    [users, search]
  );

  // Group by department
  const grouped = useMemo(() => {
    const map = new Map<string, UserItem[]>();
    for (const u of filtered) {
      const dept = u.department || 'Fără departament';
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(u);
    }
    // Sort departments alphabetically, "Fără departament" last
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
            setCreating(false);
            onCreated(conv.id);
            return;
          }
        }
      }
    }

    // Create new conversation
    const { data: newConv } = await supabase
      .from('chat_conversations')
      .insert({ type: 'direct', created_by: user.id })
      .select('id')
      .single();

    if (newConv) {
      await supabase.from('chat_participants').insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: targetUserId },
      ]);
      setCreating(false);
      onCreated(newConv.id);
    } else {
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
                          <Avatar className="h-8 w-8">
                            {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                            <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                              {u.full_name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.full_name}</p>
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
