
-- Allow all authenticated users to view profiles (intranet - colleagues need to see each other for chat, directory, etc.)
CREATE POLICY "Authenticated users can view all profiles for chat"
ON public.profiles FOR SELECT
TO authenticated
USING (true);
