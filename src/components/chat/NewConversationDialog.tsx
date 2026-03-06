import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search } from 'lucide-react';
import { formatNumePrenume } from '@/utils/formatName';

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

  useEffect(() => {
    if (!open || !user) return;
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
      });
  }, [open, user]);

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(search.toLowerCase())
  );

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
        // Verify it's a direct conversation
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
            placeholder="Caută coleg..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1">
            {filtered.map(u => (
              <button
                key={u.user_id}
                onClick={() => handleSelect(u.user_id)}
                disabled={creating}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Avatar className="h-8 w-8">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                  <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                    {u.full_name.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name}</p>
                  {u.department && (
                    <p className="text-xs text-muted-foreground truncate">{u.department}</p>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Niciun rezultat</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationDialog;
