
-- Room bookings table
CREATE TABLE public.room_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL CHECK (room IN ('sala_conferinte', 'biblioteca')),
  title text NOT NULL,
  description text,
  booked_by uuid NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view bookings
CREATE POLICY "Authenticated users can view room bookings"
  ON public.room_bookings FOR SELECT TO authenticated
  USING (true);

-- Users can create bookings
CREATE POLICY "Users can create room bookings"
  ON public.room_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = booked_by);

-- Users can update own bookings
CREATE POLICY "Users can update own room bookings"
  ON public.room_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = booked_by);

-- Users can delete own bookings
CREATE POLICY "Users can delete own room bookings"
  ON public.room_bookings FOR DELETE TO authenticated
  USING (auth.uid() = booked_by);

-- Admins can manage all bookings
CREATE POLICY "Admins can manage all room bookings"
  ON public.room_bookings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_bookings;

-- Updated_at trigger
CREATE TRIGGER update_room_bookings_updated_at
  BEFORE UPDATE ON public.room_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
