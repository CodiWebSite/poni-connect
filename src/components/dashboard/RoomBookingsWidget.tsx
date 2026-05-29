import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Plus, DoorOpen, Clock, CalendarDays } from 'lucide-react';
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type RoomBooking = {
  id: string;
  room: string;
  title: string;
  start_time: string;
  end_time: string;
  booked_by: string;
  profile_name?: string;
};

const ROOMS = [
  { id: 'sala_conferinte', label: 'Sala de Conferințe', icon: '🏛️' },
  { id: 'biblioteca', label: 'Biblioteca', icon: '📚' },
];

export default function RoomBookingsWidget() {
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const todayEnd = useMemo(() => endOfDay(new Date()).toISOString(), []);

  useEffect(() => {
    fetchBookings();

    const channel = supabase
      .channel('room-bookings-widget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from('room_bookings')
      .select('id, room, title, start_time, end_time, booked_by')
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd)
      .eq('status', 'confirmed')
      .order('start_time');

    if (error) {
      console.error('Error fetching bookings:', error);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data || []).map(b => b.booked_by))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      if (profiles) {
        profiles.forEach(p => { profileMap[p.user_id] = p.full_name; });
      }
    }

    setBookings((data || []).map(b => ({
      ...b,
      profile_name: profileMap[b.booked_by] || 'Necunoscut',
    })));
    setLoading(false);
  };

  const now = new Date();

  const getCurrentBooking = (roomId: string) =>
    bookings.find(b =>
      b.room === roomId &&
      new Date(b.start_time) <= now &&
      new Date(b.end_time) > now
    );

  const getNextBooking = (roomId: string) =>
    bookings
      .filter(b => b.room === roomId && new Date(b.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  return (
    <Card className="border-primary/20 shadow-card-hover hover:-translate-y-0.5 transition-all duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-primary" />
            Programări Săli — Astăzi
            <Badge variant="outline" className="text-[10px] font-normal">
              {format(new Date(), 'd MMM', { locale: ro })}
            </Badge>
          </CardTitle>
          <Link to="/room-bookings">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" />
              Rezervă
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : (
          ROOMS.map(room => {
            const current = getCurrentBooking(room.id);
            const next = getNextBooking(room.id);
            const isOccupied = !!current;

            return (
              <div
                key={room.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  isOccupied
                    ? "bg-destructive/5 border-destructive/20"
                    : "bg-success/5 border-success/20"
                )}
              >
                <div className="text-2xl">{room.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{room.label}</p>
                  {isOccupied ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                      </span>
                      <span className="text-xs text-destructive font-medium truncate">
                        Ocupată — {current.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        până la {format(new Date(current.end_time), 'HH:mm')}
                      </span>
                    </div>
                  ) : next ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-2 w-2">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                      </span>
                      <span className="text-xs text-success font-medium">Liberă acum</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        Următoare: {format(new Date(next.start_time), 'HH:mm')} — {next.title}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-2 w-2">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                      </span>
                      <span className="text-xs text-success font-medium">Liberă toată ziua</span>
                    </div>
                  )}
                </div>
                <Link to="/room-bookings">
                  <Button
                    size="sm"
                    variant={isOccupied ? "outline" : "default"}
                    className={cn("h-7 text-xs", !isOccupied && "bg-success hover:bg-success/90")}
                  >
                    <CalendarDays className="w-3.5 h-3.5 mr-1" />
                    {isOccupied ? 'Vezi' : 'Rezervă'}
                  </Button>
                </Link>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
