import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Plus, Users, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumePrenume } from '@/utils/formatName';
import NewConversationDialog from './NewConversationDialog';

interface ConversationItem {
  id: string;
  type: string;
  name: string | null;
  department: string | null;
  updated_at: string;
  other_user?: { full_name: string; avatar_url: string | null; user_id: string };
  last_message?: string;
  unread_count: number;
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
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) return;

    // Get conversations user participates in
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

    // For direct convos, get the other user's profile
    const items: ConversationItem[] = [];

    for (const conv of convData) {
      let otherUser: ConversationItem['other_user'] = undefined;

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
        }
      }

      // Get last message
      const { data: lastMsg } = await supabase
        .from('chat_messages')
        .select('content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Count unread
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
        last_message: lastMsg?.[0]?.content,
        unread_count: unreadCount,
      });
    }

    setConversations(items);
    setLoading(false);
  };

  useEffect(() => { fetchConversations(); }, [user]);

  const filtered = conversations.filter(c => {
    const label = c.type === 'direct' ? c.other_user?.full_name : c.name;
    return !search || (label || '').toLowerCase().includes(search.toLowerCase());
  });

  const handleCreated = (convId: string) => {
    setDialogOpen(false);
    fetchConversations();
    onSelect(convId);
  };

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="p-3 space-y-2 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Conversații</h2>
          <Button size="icon" variant="ghost" onClick={() => setDialogOpen(true)} className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
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
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    selectedId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    {avatarUrl && <AvatarImage src={avatarUrl} />}
                    <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                      {isGroup ? <Users className="h-4 w-4" /> : initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{label}</span>
                      {conv.unread_count > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <NewConversationDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={handleCreated} />
    </div>
  );
};

export default ConversationList;
