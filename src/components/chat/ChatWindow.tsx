import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, MessageCircle, Paperclip, Smile, FileText, FileSpreadsheet, FileType, Presentation, Film, Download, X, Check, CheckCheck, Trash2, Search, FolderOpen, ChevronUp, ChevronDown, XCircle, ArrowLeft, MoreVertical, Users } from 'lucide-react';
import SharedMediaPanel from './SharedMediaPanel';
import GroupInfoPanel from './GroupInfoPanel';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatNumePrenume } from '@/utils/formatName';
import { toast } from '@/hooks/use-toast';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasOwn: boolean;
}

interface Props {
  conversationId: string | null;
  onMessagesRead?: () => void;
  onBack?: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const ChatWindow = ({ conversationId, onMessagesRead, onBack }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [convName, setConvName] = useState('');
  const [convType, setConvType] = useState<'direct' | 'group'>('direct');
  const [convAdminId, setConvAdminId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  // hoveredMsg removed - using DropdownMenu instead
  const [unsendMsgId, setUnsendMsgId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
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
      setIsOnline(data.is_online && data.last_seen_at >= fiveMinAgo);
      setLastSeen(data.last_seen_at);
    } else {
      setIsOnline(false);
      setLastSeen(null);
    }
  }, []);

  const fetchOtherLastRead = useCallback(async () => {
    if (!conversationId || !user) return;
    const { data } = await supabase
      .from('chat_participants')
      .select('last_read_at')
      .eq('conversation_id', conversationId)
      .neq('user_id', user.id)
      .maybeSingle();
    setOtherLastRead(data?.last_read_at || null);
  }, [conversationId, user]);

  const markAsRead = useCallback(async () => {
    if (!conversationId || !user) return;
    await supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    onMessagesRead?.();
  }, [conversationId, user, onMessagesRead]);

  // Fetch reactions for all messages in the conversation
  const fetchReactions = useCallback(async (messageIds: string[]) => {
    if (!messageIds.length || !user) return;
    const { data: rxData } = await supabase
      .from('chat_reactions' as any)
      .select('message_id, emoji, user_id')
      .in('message_id', messageIds);
    if (!rxData) return;
    
    const grouped: Record<string, Reaction[]> = {};
    const byMsg: Record<string, Record<string, string[]>> = {};
    
    for (const r of rxData as any[]) {
      if (!byMsg[r.message_id]) byMsg[r.message_id] = {};
      if (!byMsg[r.message_id][r.emoji]) byMsg[r.message_id][r.emoji] = [];
      byMsg[r.message_id][r.emoji].push(r.user_id);
    }
    
    for (const [msgId, emojis] of Object.entries(byMsg)) {
      grouped[msgId] = Object.entries(emojis).map(([emoji, users]) => ({
        emoji,
        count: users.length,
        users,
        hasOwn: users.includes(user.id),
      }));
    }
    
    setReactions(grouped);
  }, [user]);

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions[messageId]?.find(r => r.emoji === emoji && r.hasOwn);
    if (existing) {
      await supabase
        .from('chat_reactions' as any)
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      await supabase
        .from('chat_reactions' as any)
        .insert({ message_id: messageId, user_id: user.id, emoji } as any);
    }
    // Refetch reactions for this message
    const { data: rxData } = await supabase
      .from('chat_reactions' as any)
      .select('message_id, emoji, user_id')
      .eq('message_id', messageId);
    
    if (rxData) {
      const byEmoji: Record<string, string[]> = {};
      for (const r of rxData as any[]) {
        if (!byEmoji[r.emoji]) byEmoji[r.emoji] = [];
        byEmoji[r.emoji].push(r.user_id);
      }
      setReactions(prev => ({
        ...prev,
        [messageId]: Object.entries(byEmoji).map(([em, users]) => ({
          emoji: em, count: users.length, users, hasOwn: users.includes(user.id),
        })),
      }));
    } else {
      setReactions(prev => {
        const copy = { ...prev };
        delete copy[messageId];
        return copy;
      });
    }
  };

  const handleUnsend = async () => {
    if (!unsendMsgId || !user) return;
    const msg = messages.find(m => m.id === unsendMsgId);
    if (!msg || msg.sender_id !== user.id) return;
    
    // Delete from storage if attachment exists
    if (msg.attachment_url) {
      try {
        const url = new URL(msg.attachment_url);
        const storagePath = url.pathname.split('/chat-attachments/')[1];
        if (storagePath) {
          await supabase.storage.from('chat-attachments').remove([decodeURIComponent(storagePath)]);
        }
      } catch {}
    }
    
    await supabase.from('chat_messages').delete().eq('id', unsendMsgId);
    setMessages(prev => prev.filter(m => m.id !== unsendMsgId));
    setUnsendMsgId(null);
    toast({ title: 'Mesaj șters', description: 'Mesajul a fost eliminat.' });
  };

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
      fetchReactions(msgData.map(m => m.id));
    }

    await markAsRead();
    await fetchOtherLastRead();
  };

  useEffect(() => {
    setMessages([]);
    profileCache.current = {};
    setOtherUserId(null);
    setIsOnline(false);
    setLastSeen(null);
    setOtherLastRead(null);
    setPendingFile(null);
    setPendingPreview(null);
    setReactions({});
    fetchMessages();
  }, [conversationId]);

  // Realtime presence + polling fallback
  useEffect(() => {
    if (!otherUserId || !conversationId) return;

    // Immediate fetch
    fetchPresence(otherUserId);
    fetchOtherLastRead();

    // Realtime subscription for other user's presence changes
    const presenceChannel = supabase
      .channel(`presence-${otherUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
        filter: `user_id=eq.${otherUserId}`,
      }, (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          const row = payload.new as any;
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          setIsOnline(row.is_online && row.last_seen_at >= fiveMinAgo);
          setLastSeen(row.last_seen_at);
        }
      })
      .subscribe();

    // Fallback polling every 30s
    const interval = setInterval(() => {
      fetchPresence(otherUserId);
      fetchOtherLastRead();
    }, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(presenceChannel);
    };
  }, [otherUserId, conversationId, fetchPresence, fetchOtherLastRead]);

  // Realtime subscription for messages
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
          await markAsRead();
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const deleted = payload.old as any;
        setMessages(prev => prev.filter(m => m.id !== deleted.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user, markAsRead]);

  // Listen for participant updates (to detect when other user reads messages)
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`read-${conversationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (user && updated.user_id !== user.id) {
          setOtherLastRead(updated.last_read_at);
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
    const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (error) {
      toast({ title: 'Eroare la încărcare', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
    return { url: urlData.publicUrl, type: getAttachmentType(file), name: file.name };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400 * 1024 * 1024) {
      toast({ title: 'Fișier prea mare', description: 'Dimensiunea maximă este 400MB.', variant: 'destructive' });
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelFile = () => { setPendingFile(null); setPendingPreview(null); };

  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingFile) || !conversationId || !user) return;
    setSending(true);
    try {
      let attachmentData: { url: string; type: string; name: string } | null = null;
      if (pendingFile) {
        setUploading(true);
        attachmentData = await uploadFile(pendingFile);
        setUploading(false);
        if (!attachmentData && !newMessage.trim()) { setSending(false); return; }
      }
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim() || null,
        attachment_url: attachmentData?.url || null,
        attachment_type: attachmentData?.type || null,
        attachment_name: attachmentData?.name || null,
      } as any);
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      setNewMessage('');
      setPendingFile(null);
      setPendingPreview(null);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleEmojiSelect = (emoji: any) => {
    setNewMessage(prev => prev + emoji.native);
  };

  // Download file with original name
  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  // Message status
  const getMessageStatus = (msg: Message, isLast: boolean) => {
    if (msg.sender_id !== user?.id) return null;
    if (otherLastRead && msg.created_at <= otherLastRead) return 'seen';
    if (isOnline) return 'delivered';
    return 'sent';
  };

  const renderMessageStatus = (status: string | null) => {
    if (!status) return null;
    switch (status) {
      case 'sent':
        return <span className="inline-flex items-center gap-0.5 text-muted-foreground" title="Trimis"><Check className="h-3 w-3" /></span>;
      case 'delivered':
        return <span className="inline-flex items-center text-muted-foreground" title="Livrat"><CheckCheck className="h-3.5 w-3.5" /></span>;
      case 'seen':
        return <span className="inline-flex items-center text-primary" title="Văzut"><CheckCheck className="h-3.5 w-3.5" /></span>;
      default: return null;
    }
  };

  const getDocIcon = (name: string | null) => {
    const ext = (name || '').split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return <FileType className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case 'xls': case 'xlsx': case 'csv': return <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />;
      case 'ppt': case 'pptx': return <Presentation className="h-4 w-4 text-orange-500 flex-shrink-0" />;
      case 'doc': case 'docx': return <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />;
      default: return <FileText className="h-4 w-4 flex-shrink-0" />;
    }
  };

  const renderAttachment = (msg: Message) => {
    if (!msg.attachment_url) return null;
    if (msg.attachment_type === 'image') {
      return (
        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img src={msg.attachment_url} alt={msg.attachment_name || 'Imagine'} className="max-w-[240px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity" />
        </a>
      );
    }
    if (msg.attachment_type === 'video') {
      return <video src={msg.attachment_url} controls className="max-w-[280px] max-h-[200px] rounded-lg mt-1" />;
    }
    return (
      <button
        onClick={() => handleDownload(msg.attachment_url!, msg.attachment_name || 'document')}
        className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors text-xs w-full text-left"
      >
        {getDocIcon(msg.attachment_name)}
        <span className="truncate flex-1">{msg.attachment_name || 'Document'}</span>
        <Download className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
      </button>
    );
  };

  const renderReactions = (msgId: string) => {
    const msgReactions = reactions[msgId];
    if (!msgReactions?.length) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {msgReactions.map(r => (
          <button
            key={r.emoji}
            onClick={() => toggleReaction(msgId, r.emoji)}
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
              r.hasOwn
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-muted/50 border-border hover:bg-muted"
            )}
          >
            <span>{r.emoji}</span>
            <span className="text-[10px] font-medium">{r.count}</span>
          </button>
        ))}
      </div>
    );
  };

  // Search logic
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const indices = messages
      .map((m, i) => (m.content && m.content.toLowerCase().includes(q)) ? i : -1)
      .filter(i => i !== -1);
    setSearchResults(indices);
    setSearchIndex(0);
    // Scroll to first result
    if (indices.length > 0) {
      const msgId = messages[indices[0]]?.id;
      if (msgId && messageRefs.current[msgId]) {
        messageRefs.current[msgId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [searchQuery, messages]);

  const navigateSearch = (direction: 'prev' | 'next') => {
    if (!searchResults.length) return;
    let newIdx = direction === 'next' ? searchIndex + 1 : searchIndex - 1;
    if (newIdx >= searchResults.length) newIdx = 0;
    if (newIdx < 0) newIdx = searchResults.length - 1;
    setSearchIndex(newIdx);
    const msgId = messages[searchResults[newIdx]]?.id;
    if (msgId && messageRefs.current[msgId]) {
      messageRefs.current[msgId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const statusText = isOnline
    ? 'Online'
    : lastSeen
      ? `Ultima dată activ ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: ro })}`
      : 'Offline';

  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const q = searchQuery.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-300 dark:bg-yellow-600 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + searchQuery.length)}</mark>
        {text.slice(idx + searchQuery.length)}
      </>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border bg-card flex items-center gap-2">
        {onBack && (
          <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0 text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => otherUserId && setShowMediaPanel(true)}
            className={cn("font-semibold text-foreground text-left text-sm truncate block", otherUserId && "hover:underline cursor-pointer")}
          >
            {convName}
          </button>
          {otherUserId && (
            <div className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-green-500" : "bg-muted-foreground/30")} />
              <span className={cn("text-[11px]", isOnline ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                {statusText}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setShowSearch(s => !s); setSearchQuery(''); }}>
            <Search className="h-4 w-4" />
          </Button>
          {otherUserId && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowMediaPanel(true)}>
              <FolderOpen className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="Caută în conversație..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 text-sm flex-1"
            autoFocus
          />
          {searchResults.length > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {searchIndex + 1}/{searchResults.length}
            </span>
          )}
          {searchResults.length > 0 && (
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => navigateSearch('prev')}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => navigateSearch('next')}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === user?.id;
          const showAvatar = !isOwn && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
          const isLastOwnInGroup = isOwn && (i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id);
          const msgStatus = getMessageStatus(msg, isLastOwnInGroup);
          
          const isSearchMatch = searchResults.includes(i);
          const isCurrentSearchResult = searchResults[searchIndex] === i;

          return (
            <div
              key={msg.id}
              ref={el => { messageRefs.current[msg.id] = el; }}
              className={cn(
                "flex gap-2 group transition-colors duration-300 rounded-lg px-1 -mx-1",
                isOwn ? "justify-end" : "justify-start",
                isCurrentSearchResult && "bg-yellow-200/30 dark:bg-yellow-800/20",
                isSearchMatch && !isCurrentSearchResult && "bg-yellow-100/15 dark:bg-yellow-900/10"
              )}
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
                <div className={cn("flex items-end gap-1", isOwn ? "flex-row-reverse" : "flex-row")}>
                  <div
                    className={cn(
                      "inline-block rounded-2xl text-sm overflow-hidden",
                      isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md",
                      (msg.content || msg.attachment_type !== 'image') && "px-3 py-2"
                    )}
                  >
                    {msg.attachment_url && msg.attachment_type === 'image' && !msg.content && (
                      <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                        <img src={msg.attachment_url} alt={msg.attachment_name || 'Imagine'} className="max-w-[240px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                      </a>
                    )}
                    {msg.content && <span>{searchQuery ? highlightText(msg.content) : msg.content}</span>}
                    {msg.attachment_url && (msg.content || msg.attachment_type !== 'image') && renderAttachment(msg)}
                  </div>

                  {/* Action menu - visible on hover (desktop) or always accessible */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isOwn ? "end" : "start"} className="min-w-[180px]">
                      <div className="px-2 py-1.5">
                        <p className="text-xs text-muted-foreground mb-1.5">Reacții</p>
                        <div className="flex items-center gap-1">
                          {QUICK_REACTIONS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className={cn(
                                "text-lg hover:scale-125 transition-transform p-0.5 rounded",
                                reactions[msg.id]?.find(r => r.emoji === emoji && r.hasOwn) && "bg-primary/15"
                              )}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      {isOwn && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setUnsendMsgId(msg.id)}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Șterge mesajul
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {renderReactions(msg.id)}

                <div className={cn("flex items-center gap-1 mt-0.5 mx-1", isOwn ? "justify-end" : "justify-start")}>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(msg.created_at), 'HH:mm', { locale: ro })}
                  </span>
                  {isOwn && renderMessageStatus(msgStatus)}
                </div>
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

      {/* Input */}
      <div className="p-2 sm:p-3 border-t border-border bg-card">
        <div className="flex items-center gap-1">
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" onChange={handleFileSelect} />
          <Button size="icon" variant="ghost" className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 text-muted-foreground hover:text-foreground" onClick={() => fileInputRef.current?.click()} disabled={sending}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 text-muted-foreground hover:text-foreground hidden sm:inline-flex" disabled={sending}>
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto p-0 border-0">
              <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="auto" locale="ro" previewPosition="none" skinTonePosition="search" maxFrequentRows={2} />
            </PopoverContent>
          </Popover>
          <Input
            placeholder="Scrie un mesaj..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="flex-1 h-9 text-[16px] sm:text-sm"
          />
          <Button size="icon" onClick={handleSend} disabled={sending || (!newMessage.trim() && !pendingFile)} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {uploading && <p className="text-xs text-muted-foreground mt-1 ml-2">Se încarcă fișierul...</p>}
      </div>

      {/* Unsend confirmation dialog */}
      <AlertDialog open={!!unsendMsgId} onOpenChange={(open) => !open && setUnsendMsgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge mesajul?</AlertDialogTitle>
            <AlertDialogDescription>
              Mesajul va fi eliminat pentru toți participanții. Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnsend} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Shared media panel */}
      {conversationId && (
        <SharedMediaPanel
          conversationId={conversationId}
          open={showMediaPanel}
          onOpenChange={setShowMediaPanel}
          convName={convName}
        />
      )}
    </div>
  );
};

export default ChatWindow;
