
-- Enable realtime for chat_participants (for seen/read status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
