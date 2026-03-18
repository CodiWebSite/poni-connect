import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { playNotificationSound } from '@/utils/notificationSound';
import { formatNumePrenume } from '@/utils/formatName';

/**
 * Global hook that listens for new chat messages across ALL conversations
 * the user participates in, and shows a toast + plays sound when a message
 * arrives in a conversation that is NOT currently active.
 */
export function useChatNotifications(activeConversationId?: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const activeConvRef = useRef(activeConversationId);

  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-chat-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          const msg = payload.new as any;

          // Ignore own messages
          if (msg.sender_id === user.id) return;

          // Check if user is participant in this conversation
          const { data: participation } = await supabase
            .from('chat_participants')
            .select('id')
            .eq('conversation_id', msg.conversation_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!participation) return;

          // Don't notify if user is viewing this conversation
          if (activeConvRef.current === msg.conversation_id) return;

          // Get sender name
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', msg.sender_id)
            .maybeSingle();

          const { data: senderEpd } = await supabase
            .from('employee_personal_data')
            .select('first_name, last_name')
            .eq('email', (await supabase.auth.getUser()).data.user?.email || '__no_match__')
            .maybeSingle();

          // Actually get sender's email to find EPD
          const senderName = senderProfile?.full_name || 'Coleg';

          const messagePreview = msg.content
            ? msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : '')
            : msg.attachment_name || 'Atașament';

          playNotificationSound('message');

          toast({
            title: `💬 ${senderName}`,
            description: messagePreview,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
