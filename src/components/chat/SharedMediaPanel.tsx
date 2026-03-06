import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FileText, Image, Film, Download, X, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatNumePrenume } from '@/utils/formatName';

interface SharedItem {
  id: string;
  attachment_url: string;
  attachment_type: string;
  attachment_name: string | null;
  created_at: string;
  sender_name: string;
}

interface Props {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  convName: string;
}

const SharedMediaPanel = ({ conversationId, open, onOpenChange, convName }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSharedMedia = useCallback(async () => {
    if (!conversationId || !user) return;
    setLoading(true);

    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('id, attachment_url, attachment_type, attachment_name, created_at, sender_id')
      .eq('conversation_id', conversationId)
      .not('attachment_url', 'is', null)
      .order('created_at', { ascending: false });

    if (!msgData) { setLoading(false); return; }

    // Get unique sender ids
    const senderIds = [...new Set(msgData.map(m => m.sender_id))];
    const profiles: Record<string, string> = {};

    for (const sid of senderIds) {
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', sid)
        .maybeSingle();
      profiles[sid] = p ? formatNumePrenume({ fullName: p.full_name }) : 'Utilizator';
    }

    setItems(
      msgData
        .filter(m => m.attachment_url && m.attachment_type)
        .map(m => ({
          id: m.id,
          attachment_url: m.attachment_url!,
          attachment_type: m.attachment_type!,
          attachment_name: m.attachment_name,
          created_at: m.created_at,
          sender_name: profiles[m.sender_id] || 'Utilizator',
        }))
    );
    setLoading(false);
  }, [conversationId, user]);

  useEffect(() => {
    if (open) fetchSharedMedia();
  }, [open, fetchSharedMedia]);

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
      window.open(url, '_blank');
    }
  };

  const images = items.filter(i => i.attachment_type === 'image');
  const videos = items.filter(i => i.attachment_type === 'video');
  const documents = items.filter(i => i.attachment_type !== 'image' && i.attachment_type !== 'video');

  const renderImageGrid = () => {
    if (!images.length) return <EmptyState text="Nicio imagine partajată" />;
    return (
      <div className="grid grid-cols-3 gap-2 p-3">
        {images.map(item => (
          <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
            <img
              src={item.attachment_url}
              alt={item.attachment_name || 'Imagine'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-background/80 hover:bg-background text-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button onClick={() => handleDownload(item.attachment_url, item.attachment_name || 'imagine.jpg')} className="p-1.5 rounded-full bg-background/80 hover:bg-background text-foreground">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-[9px] text-white truncate">{format(new Date(item.created_at), 'd MMM yyyy', { locale: ro })}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderVideoList = () => {
    if (!videos.length) return <EmptyState text="Niciun video partajat" />;
    return (
      <div className="p-3 space-y-2">
        {videos.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="w-16 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
              <video src={item.attachment_url} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground break-all">{item.attachment_name || 'Video'}</p>
              <p className="text-[11px] text-muted-foreground">{item.sender_name} · {format(new Date(item.created_at), 'd MMM yyyy', { locale: ro })}</p>
            </div>
            <button onClick={() => handleDownload(item.attachment_url, item.attachment_name || 'video.mp4')} className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <Download className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderDocumentList = () => {
    if (!documents.length) return <EmptyState text="Niciun document partajat" />;
    return (
      <div className="p-3 space-y-2">
        {documents.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground break-all">{item.attachment_name || 'Document'}</p>
              <p className="text-[11px] text-muted-foreground">{item.sender_name} · {format(new Date(item.created_at), 'd MMM yyyy', { locale: ro })}</p>
            </div>
            <button onClick={() => handleDownload(item.attachment_url, item.attachment_name || 'document')} className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <Download className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="text-base">Media partajate — {convName}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="images" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-3 mt-2 grid grid-cols-3">
            <TabsTrigger value="images" className="text-xs gap-1">
              <Image className="h-3.5 w-3.5" />
              Poze ({images.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="text-xs gap-1">
              <Film className="h-3.5 w-3.5" />
              Video ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />
              Documente ({documents.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-1">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Se încarcă...</div>
            ) : (
              <>
                <TabsContent value="images" className="m-0">{renderImageGrid()}</TabsContent>
                <TabsContent value="videos" className="m-0">{renderVideoList()}</TabsContent>
                <TabsContent value="documents" className="m-0">{renderDocumentList()}</TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="p-8 text-center text-muted-foreground text-sm">{text}</div>
);

export default SharedMediaPanel;
