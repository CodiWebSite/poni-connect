CREATE POLICY "Anon can view confirmed room bookings"
  ON public.room_bookings
  FOR SELECT
  TO anon
  USING (status = 'confirmed');