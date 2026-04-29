import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ChatBetaBanner from '@/components/chat/ChatBetaBanner';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import { useIsMobile } from '@/hooks/use-mobile';
import { setActiveChatConversation } from '@/hooks/useChatNotifications';

const Chat = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    searchParams.get('conversation')
  );
  const [listKey, setListKey] = useState(0);
  const isMobile = useIsMobile();
  const showList = !isMobile || !selectedConvId;
  const showChat = !isMobile || !!selectedConvId;

  // React to URL param changes (e.g. from push notification deep-link)
  useEffect(() => {
    const fromUrl = searchParams.get('conversation');
    if (fromUrl && fromUrl !== selectedConvId) {
      setSelectedConvId(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Keep URL in sync when user changes conversation manually
  useEffect(() => {
    const current = searchParams.get('conversation');
    if (selectedConvId && selectedConvId !== current) {
      setSearchParams({ conversation: selectedConvId }, { replace: true });
    } else if (!selectedConvId && current) {
      searchParams.delete('conversation');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvId]);

  const handleMessagesRead = useCallback(() => {
    setListKey(k => k + 1);
  }, []);

  // Tell global notifier which conversation is active
  useEffect(() => {
    setActiveChatConversation(selectedConvId);
    return () => setActiveChatConversation(null);
  }, [selectedConvId]);

  // On mobile when inside a conversation, render without MainLayout for full-screen chat
  if (isMobile && selectedConvId) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <ChatWindow
          conversationId={selectedConvId}
          onMessagesRead={handleMessagesRead}
          onBack={() => setSelectedConvId(null)}
        />
      </div>
    );
  }

  return (
    <MainLayout title="Mesagerie" description="Chat intern între colegi">
      <ChatBetaBanner />

      <div
        className="bg-card border border-border rounded-xl overflow-hidden flex"
        style={{ height: isMobile ? 'calc(100dvh - 160px)' : 'calc(100vh - 220px)' }}
      >
        {showList && (
          <div className={isMobile ? "w-full h-full" : "w-[320px] flex-shrink-0 border-r border-border"}>
            <ConversationList key={listKey} selectedId={selectedConvId} onSelect={setSelectedConvId} />
          </div>
        )}

        {showChat && !isMobile && (
          <div className="flex-1 flex flex-col min-w-0">
            <ChatWindow
              conversationId={selectedConvId}
              onMessagesRead={handleMessagesRead}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Chat;
