import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Plus, Users, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumePrenume } from '@/utils/formatName';
import NewConversationDialog from './NewConversationDialog';
import NewGroupDialog from './NewGroupDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ConversationItem {
  id: string;
  type: string;
  name: string | null;
  department: string | null;
  updated_at: string;
  other_user?: { full_name: string; avatar_url: string | null; user_id: string };
  last_message: string | null;
  unread_count: number;
  is_online: boolean;
}

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ConversationList = ({ selectedId, onSelect }: Props) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ensure department group exists on first load
  const deptGroupEnsured = useState(false);
  
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Auto-create/join department group (once per session)
    if (!deptGroupEnsured[0]) {
      deptGroupEnsured[1](true);
      await supabase.rpc('ensure_department_group', { _user_id: user.id }).catch(() => {});
    }

    const { data: participantData } = await supabase
      .from('chat_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id);

    if (!participantData?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = participantData.map(p => p.conversation_id);
    const lastReadMap = Object.fromEntries(participantData.map(p => [p.conversation_id, p.last_read_at]));

    const { data: convData } = await supabase
      .from('chat_conversations')
      .select('*')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!convData) { setLoading(false); return; }

    const items: ConversationItem[] = [];

    for (const conv of convData) {
      let otherUser: ConversationItem['other_user'] = undefined;
      let isOnline = false;

      if (conv.type === 'direct') {
        const { data: parts } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('conversation_id', conv.id)
          .neq('user_id', user.id)
          .limit(1);

        if (parts?.[0]) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, user_id')
            .eq('user_id', parts[0].user_id)
            .maybeSingle();

          if (profile) {
            otherUser = {
              full_name: formatNumePrenume({ fullName: profile.full_name }),
              avatar_url: profile.avatar_url,
              user_id: profile.user_id,
            };
          }

          // Check presence
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: presence } = await supabase
            .from('user_presence')
            .select('is_online, last_seen_at')
            .eq('user_id', parts[0].user_id)
            .maybeSingle();
          isOnline = !!(presence?.is_online && presence.last_seen_at >= fiveMinAgo);
        }
      }

      const { data: lastMsg } = await supabase
        .from('chat_messages')
        .select('content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastRead = lastReadMap[conv.id];
      let unreadCount = 0;
      if (lastRead) {
        const { count } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .gt('created_at', lastRead);
        unreadCount = count || 0;
      }

      items.push({
        id: conv.id,
        type: conv.type,
        name: conv.name,
        department: conv.department,
        updated_at: conv.updated_at,
        other_user: otherUser,
        last_message: lastMsg?.[0]?.content || null,
        unread_count: unreadCount,
        is_online: isOnline,
      });
    }

    setConversations(items);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Expose refresh method via selecting a conversation (marks as read → refresh list)
  const handleSelect = useCallback((convId: string) => {
    // Immediately clear badge locally for instant feedback
    setConversations(prev =>
      prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)
    );
    onSelect(convId);
  }, [onSelect]);

  // Listen for presence changes to update online indicators instantly
  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase
      .channel('chat-list-presence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      }, (payload) => {
        if (!payload.new || typeof payload.new !== 'object') return;
        const row = payload.new as any;
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const nowOnline = !!(row.is_online && row.last_seen_at >= fiveMinAgo);

        setConversations(prev =>
          prev.map(c => {
            if (c.type === 'direct' && c.other_user?.user_id === row.user_id) {
              return { ...c, is_online: nowOnline };
            }
            return c;
          })
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(presenceChannel); };
  }, [user]);

  // Listen for new messages in any conversation to update badges
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-list-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === user.id) return; // own messages don't increment badge

        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === msg.conversation_id);
          if (idx === -1) {
            // New conversation we don't have yet — refetch
            fetchConversations();
            return prev;
          }
          const updated = [...prev];
          const conv = { ...updated[idx] };
          // Only increment if this conversation is NOT currently selected
          if (msg.conversation_id !== selectedId) {
            conv.unread_count = (conv.unread_count || 0) + 1;
          }
          conv.last_message = msg.content || (msg.attachment_name ? `📎 ${msg.attachment_name}` : '📎 Atașament');
          conv.updated_at = msg.created_at;
          updated[idx] = conv;
          // Re-sort by updated_at desc
          updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          return updated;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedId, fetchConversations]);

  const filtered = conversations.filter(c => {
    const label = c.type === 'direct' ? c.other_user?.full_name : c.name;
    return !search || (label || '').toLowerCase().includes(search.toLowerCase());
  });

  const handleCreated = (convId: string) => {
    setDialogOpen(false);
    fetchConversations();
    onSelect(convId);
  };

  // Called by parent when messages are read in the active conversation
  const refreshUnread = useCallback(() => {
    if (selectedId) {
      setConversations(prev =>
        prev.map(c => c.id === selectedId ? { ...c, unread_count: 0 } : c)
      );
    }
  }, [selectedId]);

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="p-3 space-y-2 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Conversații</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialogOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Conversație directă
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupDialogOpen(true)} className="gap-2">
                <Users className="h-4 w-4" />
                Grup nou
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută conversație..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Se încarcă...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nicio conversație. Apasă + pentru a începe una.
          </div>
        ) : (
          <div className="p-1">
            {filtered.map(conv => {
              const isGroup = conv.type === 'group';
              const label = isGroup ? (conv.name || conv.department) : conv.other_user?.full_name || 'Utilizator';
              const avatarUrl = !isGroup ? conv.other_user?.avatar_url : null;
              const initials = (label || 'U').substring(0, 2).toUpperCase();

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    selectedId === conv.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-9 w-9">
                      {avatarUrl && <AvatarImage src={avatarUrl} />}
                      <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {isGroup ? <Users className="h-4 w-4" /> : initials}
                      </AvatarFallback>
                    </Avatar>
                    {!isGroup && conv.is_online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{label}</span>
                      {conv.unread_count > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center animate-scale-in">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className={cn(
                        "text-xs truncate",
                        conv.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {conv.last_message}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <NewConversationDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={handleCreated} />
      <NewGroupDialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} onCreated={handleCreated} />
    </div>
  );
};

export default ConversationList;
