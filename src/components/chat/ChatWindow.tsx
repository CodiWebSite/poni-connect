import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, MessageCircle, Paperclip, Smile, Image as ImageIcon, FileText, Film, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatNumePrenume } from '@/utils/formatName';
import { toast } from '@/hooks/use-toast';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
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
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const fetchPresence = useCallback(async (uid: string) => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('user_presence')
      .select('is_online, last_seen_at')
      .eq('user_id', uid)
      .maybeSingle();

    if (data) {
      const online = data.is_online && data.last_seen_at >= fiveMinAgo;
      setIsOnline(online);
      setLastSeen(data.last_seen_at);
    } else {
      setIsOnline(false);
      setLastSeen(null);
    }
  }, []);

  const fetchMessages = async () => {
    if (!conversationId) return;

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
        setOtherUserId(parts[0].user_id);
        fetchPresence(parts[0].user_id);
      }
    } else {
      setConvName(conv?.name || conv?.department || 'Grup');
      setOtherUserId(null);
    }

    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (msgData) {
      const enriched = await Promise.all(
        msgData.map(async (msg) => {
          const p = await getProfile(msg.sender_id);
          return { ...msg, sender_name: p.name, sender_avatar: p.avatar };
        })
      );
      setMessages(enriched);
    }

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
    setOtherUserId(null);
    setIsOnline(false);
    setLastSeen(null);
    setPendingFile(null);
    setPendingPreview(null);
    fetchMessages();
  }, [conversationId]);

  // Refresh presence every 30s
  useEffect(() => {
    if (!otherUserId) return;
    const interval = setInterval(() => fetchPresence(otherUserId), 30000);
    return () => clearInterval(interval);
  }, [otherUserId, fetchPresence]);

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

  const getAttachmentType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(path, file);

    if (error) {
      toast({ title: 'Eroare la încărcare', description: error.message, variant: 'destructive' });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(path);

    return {
      url: urlData.publicUrl,
      type: getAttachmentType(file),
      name: file.name,
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Fișier prea mare', description: 'Dimensiunea maximă este 20MB.', variant: 'destructive' });
      return;
    }

    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPendingPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPendingPreview(null);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelFile = () => {
    setPendingFile(null);
    setPendingPreview(null);
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingFile) || !conversationId || !user) return;
    setSending(true);

    try {
      let attachmentData: { url: string; type: string; name: string } | null = null;

      if (pendingFile) {
        setUploading(true);
        attachmentData = await uploadFile(pendingFile);
        setUploading(false);
        if (!attachmentData && !newMessage.trim()) {
          setSending(false);
          return;
        }
      }

      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim() || null,
        attachment_url: attachmentData?.url || null,
        attachment_type: attachmentData?.type || null,
        attachment_name: attachmentData?.name || null,
      } as any);

      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      setNewMessage('');
      setPendingFile(null);
      setPendingPreview(null);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setNewMessage(prev => prev + emoji.native);
  };

  const renderAttachment = (msg: Message) => {
    if (!msg.attachment_url) return null;

    if (msg.attachment_type === 'image') {
      return (
        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img
            src={msg.attachment_url}
            alt={msg.attachment_name || 'Imagine'}
            className="max-w-[240px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
      );
    }

    if (msg.attachment_type === 'video') {
      return (
        <video
          src={msg.attachment_url}
          controls
          className="max-w-[280px] max-h-[200px] rounded-lg mt-1"
        />
      );
    }

    // Document
    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors text-xs"
      >
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span className="truncate flex-1">{msg.attachment_name || 'Document'}</span>
        <Download className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
      </a>
    );
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

  const statusText = isOnline
    ? 'Online'
    : lastSeen
      ? `Ultima dată activ ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: ro })}`
      : 'Offline';

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header with online status */}
      <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{convName}</h3>
          {otherUserId && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isOnline ? "bg-green-500" : "bg-muted-foreground/30"
              )} />
              <span className={cn(
                "text-xs",
                isOnline ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              )}>
                {statusText}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === user?.id;
          const showAvatar = !isOwn && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);

          return (
            <div key={msg.id} className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}>
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
                    "inline-block rounded-2xl text-sm overflow-hidden",
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md",
                    (msg.content || msg.attachment_type !== 'image') && "px-3 py-2"
                  )}
                >
                  {msg.attachment_url && msg.attachment_type === 'image' && !msg.content && (
                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={msg.attachment_url}
                        alt={msg.attachment_name || 'Imagine'}
                        className="max-w-[240px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                  {msg.content && <span>{msg.content}</span>}
                  {msg.attachment_url && (msg.content || msg.attachment_type !== 'image') && renderAttachment(msg)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                  {format(new Date(msg.created_at), 'HH:mm', { locale: ro })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending file preview */}
      {pendingFile && (
        <div className="px-3 pt-2 border-t border-border bg-card">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
            {pendingPreview ? (
              <img src={pendingPreview} alt="Preview" className="h-12 w-12 rounded object-cover" />
            ) : pendingFile.type.startsWith('video/') ? (
              <Film className="h-8 w-8 text-muted-foreground" />
            ) : (
              <FileText className="h-8 w-8 text-muted-foreground" />
            )}
            <span className="flex-1 truncate text-foreground">{pendingFile.name}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelFile}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-center gap-1.5">
          {/* Attach button */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
            onChange={handleFileSelect}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            <Paperclip className="h-4.5 w-4.5" />
          </Button>

          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
                disabled={sending}
              >
                <Smile className="h-4.5 w-4.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto p-0 border-0">
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="auto"
                locale="ro"
                previewPosition="none"
                skinTonePosition="search"
                maxFrequentRows={2}
              />
            </PopoverContent>
          </Popover>

          <Input
            placeholder="Scrie un mesaj..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || (!newMessage.trim() && !pendingFile)}
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {uploading && (
          <p className="text-xs text-muted-foreground mt-1 ml-2">Se încarcă fișierul...</p>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
