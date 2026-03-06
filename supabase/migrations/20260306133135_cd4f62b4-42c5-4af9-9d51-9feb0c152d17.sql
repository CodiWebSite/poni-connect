-- Add group-related columns to chat_conversations
ALTER TABLE public.chat_conversations 
  ADD COLUMN IF NOT EXISTS group_avatar_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT NULL;

-- Add a DELETE policy for chat_participants so group admins can remove members
CREATE POLICY "Group admin can remove participants"
  ON public.chat_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND c.type = 'group'
        AND c.admin_id = auth.uid()
    )
  );

-- Allow group admin to update conversation (rename, change avatar)
CREATE POLICY "Group admin can update conversation"
  ON public.chat_conversations
  FOR UPDATE
  TO authenticated
  USING (
    (type = 'group' AND admin_id = auth.uid())
    OR
    (type = 'direct' AND created_by = auth.uid())
  );

-- Allow group admin to add participants to their group
CREATE POLICY "Group admin can add participants"
  ON public.chat_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND c.type = 'group'
        AND c.admin_id = auth.uid()
    )
    OR is_chat_conversation_creator(auth.uid(), conversation_id)
    OR (auth.uid() = user_id)
  );
