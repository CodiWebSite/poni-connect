
-- Allow all authenticated users to view presence for chat online indicators
CREATE POLICY "Authenticated users can view all presence"
ON public.user_presence FOR SELECT
TO authenticated
USING (true);
