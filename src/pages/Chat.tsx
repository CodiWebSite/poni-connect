import { useState, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ChatBetaBanner from '@/components/chat/ChatBetaBanner';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import { useIsMobile } from '@/hooks/use-mobile';

const Chat = () => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);
  const isMobile = useIsMobile();
  const showList = !isMobile || !selectedConvId;
  const showChat = !isMobile || !!selectedConvId;

  const handleMessagesRead = useCallback(() => {
    setListKey(k => k + 1);
  }, []);

  return (
    <MainLayout title="Mesagerie" description="Chat intern între colegi">
      {/* Show beta banner only on conversation list view (or always on desktop) */}
      {(!isMobile || !selectedConvId) && <ChatBetaBanner />}

      <div
        className="bg-card border border-border rounded-xl overflow-hidden flex"
        style={{ height: isMobile ? 'calc(100dvh - 140px)' : 'calc(100vh - 220px)' }}
      >
        {showList && (
          <div className={isMobile ? "w-full" : "w-[320px] flex-shrink-0 border-r border-border"}>
            <ConversationList key={listKey} selectedId={selectedConvId} onSelect={setSelectedConvId} />
          </div>
        )}

        {showChat && (
          <div className="flex-1 flex flex-col min-w-0">
            <ChatWindow
              conversationId={selectedConvId}
              onMessagesRead={handleMessagesRead}
              onBack={isMobile ? () => setSelectedConvId(null) : undefined}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Chat;
