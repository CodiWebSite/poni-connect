import { useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ChatBetaBanner from '@/components/chat/ChatBetaBanner';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const Chat = () => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);
  const isMobile = useIsMobile();
  const showList = !isMobile || !selectedConvId;
  const showChat = !isMobile || !!selectedConvId;

  const handleMessagesRead = useCallback(() => {
    // Trigger list re-render to clear badge
    setListKey(k => k + 1);
  }, []);

  return (
    <MainLayout title="Mesagerie" description="Chat intern între colegi">
      <ChatBetaBanner />

      <div className="bg-card border border-border rounded-xl overflow-hidden flex" style={{ height: 'calc(100vh - 220px)' }}>
        {showList && (
          <div className={isMobile ? "w-full" : "w-[320px] flex-shrink-0"}>
            <ConversationList key={listKey} selectedId={selectedConvId} onSelect={setSelectedConvId} />
          </div>
        )}

        {showChat && (
          <div className="flex-1 flex flex-col">
            {isMobile && selectedConvId && (
              <div className="p-2 border-b border-border">
                <Button variant="ghost" size="sm" onClick={() => setSelectedConvId(null)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Înapoi
                </Button>
              </div>
            )}
            <ChatWindow conversationId={selectedConvId} onMessagesRead={handleMessagesRead} />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Chat;
