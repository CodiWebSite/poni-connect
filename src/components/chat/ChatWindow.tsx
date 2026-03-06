import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatNumePrenume } from '@/utils/formatName';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
}

interface Props {
  conversationId: string | null;
}

const ChatWindow = ({ conversationId }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [convName, setConvName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Record<string, { name: string; avatar: string | null }>>({});

  const getProfile = async (userId: string) => {
    if (profileCache.current[userId]) return profileCache.current[userId];
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();
    const result = {
      name: data ? formatNumePrenume({ fullName: data.full_name }) : 'Utilizator',
      avatar: data?.avatar_url || null,
    };
    profileCache.current[userId] = result;
    return result;
  };

  const fetchMessages = async () => {
    if (!conversationId) return;

    // Get conversation info
    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('type, name, department')
      .eq('id', conversationId)
      .maybeSingle();

    if (conv?.type === 'direct') {
      const { data: parts } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user!.id)
        .limit(1);
      if (parts?.[0]) {
        const p = await getProfile(parts[0].user_id);
        setConvName(p.name);
      }
    } else {
      setConvName(conv?.name || conv?.department || 'Grup');
    }

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (data) {
      const enriched = await Promise.all(
        data.map(async (msg) => {
          const p = await getProfile(msg.sender_id);
          return { ...msg, sender_name: p.name, sender_avatar: p.avatar };
        })
      );
      setMessages(enriched);
    }

    // Mark as read
    if (user) {
      await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    }
  };

  useEffect(() => {
    setMessages([]);
    profileCache.current = {};
    fetchMessages();
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const msg = payload.new as any;
        const p = await getProfile(msg.sender_id);
        setMessages(prev => [...prev, { ...msg, sender_name: p.name, sender_avatar: p.avatar }]);

        // Mark as read
        if (user && msg.sender_id !== user.id) {
          await supabase
            .from('chat_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || !user) return;
    setSending(true);

    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: newMessage.trim(),
    });

    // Update conversation updated_at
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    setNewMessage('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <MessageCircle className="h-12 w-12 mx-auto opacity-30" />
          <p>Selectează o conversație pentru a începe</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <h3 className="font-semibold text-foreground">{convName}</h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === user?.id;
          const showAvatar = !isOwn && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);

          return (
            <div
              key={msg.id}
              className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}
            >
              {!isOwn && (
                <div className="w-8 flex-shrink-0">
                  {showAvatar && (
                    <Avatar className="h-8 w-8">
                      {msg.sender_avatar && <AvatarImage src={msg.sender_avatar} />}
                      <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                        {(msg.sender_name || 'U').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
              <div className={cn("max-w-[70%]", isOwn && "text-right")}>
                {showAvatar && !isOwn && (
                  <p className="text-[11px] text-muted-foreground mb-0.5 ml-1">{msg.sender_name}</p>
                )}
                <div
                  className={cn(
                    "inline-block px-3 py-2 rounded-2xl text-sm",
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {msg.content}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                  {format(new Date(msg.created_at), 'HH:mm', { locale: ro })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            placeholder="Scrie un mesaj..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
