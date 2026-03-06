import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, setHours, setMinutes, isWithinInterval, addWeeks, subWeeks, startOfDay, endOfDay, isBefore } from 'date-fns';
import { ro } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, Trash2, User, CalendarDays } from 'lucide-react';

type RoomBooking = {
  id: string;
  room: string;
  title: string;
  description: string | null;
  booked_by: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
};

type BookingWithProfile = RoomBooking & {
  profile_name?: string;
};

const ROOMS = [
  { id: 'sala_conferinte', label: 'Sala de Conferințe', icon: '🏛️', color: 'bg-blue-500' },
  { id: 'biblioteca', label: 'Biblioteca', icon: '📚', color: 'bg-amber-500' },
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 - 18:00

const RoomBookings = () => {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const [bookings, setBookings] = useState<BookingWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedRoom, setSelectedRoom] = useState('sala_conferinte');
  const [dialogOpen, setDialogOpen] = useState(false);

  // New booking form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRoom, setNewRoom] = useState('sala_conferinte');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newStartHour, setNewStartHour] = useState('09');
  const [newStartMin, setNewStartMin] = useState('00');
  const [newEndHour, setNewEndHour] = useState('10');
  const [newEndMin, setNewEndMin] = useState('00');
  const [submitting, setSubmitting] = useState(false);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Mon-Fri
  }, [weekStart]);

  const fetchBookings = async () => {
    const from = startOfDay(weekDays[0]).toISOString();
    const to = endOfDay(weekDays[4]).toISOString();

    const { data, error } = await supabase
      .from('room_bookings')
      .select('*')
      .gte('start_time', from)
      .lte('start_time', to)
      .eq('status', 'confirmed')
      .order('start_time');

    if (error) {
      console.error('Error fetching bookings:', error);
      return;
    }

    // Fetch profile names
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

  useEffect(() => {
    fetchBookings();

    // Realtime subscription
    const channel = supabase
      .channel('room-bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [weekStart]);

  const handleCreateBooking = async () => {
    if (!user) return;
    if (!newTitle.trim()) {
      toast({ title: 'Eroare', description: 'Titlul este obligatoriu.', variant: 'destructive' });
      return;
    }

    const startTime = new Date(`${newDate}T${newStartHour}:${newStartMin}:00`);
    const endTime = new Date(`${newDate}T${newEndHour}:${newEndMin}:00`);

    if (endTime <= startTime) {
      toast({ title: 'Eroare', description: 'Ora de sfârșit trebuie să fie după ora de început.', variant: 'destructive' });
      return;
    }

    if (isBefore(startTime, new Date())) {
      toast({ title: 'Eroare', description: 'Nu poți rezerva în trecut.', variant: 'destructive' });
      return;
    }

    // Check overlap
    const overlap = bookings.find(b =>
      b.room === newRoom &&
      b.status === 'confirmed' &&
      new Date(b.start_time) < endTime &&
      new Date(b.end_time) > startTime
    );

    if (overlap) {
      toast({ title: 'Conflict', description: `Sala este deja rezervată de ${overlap.profile_name} (${overlap.title}).`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('room_bookings').insert({
      room: newRoom,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      booked_by: user.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    });

    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Rezervarea a fost creată.' });
      setDialogOpen(false);
      resetForm();
      fetchBookings();
    }
    setSubmitting(false);
  };

  const handleCancelBooking = async (id: string) => {
    const { error } = await supabase
      .from('room_bookings')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Anulat', description: 'Rezervarea a fost anulată.' });
      fetchBookings();
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
    setNewStartHour('09');
    setNewStartMin('00');
    setNewEndHour('10');
    setNewEndMin('00');
  };

  const roomBookings = bookings.filter(b => b.room === selectedRoom);
  const currentRoom = ROOMS.find(r => r.id === selectedRoom)!;

  // Check if room is currently occupied
  const now = new Date();
  const currentBooking = (room: string) => bookings.find(b =>
    b.room === room &&
    b.status === 'confirmed' &&
    new Date(b.start_time) <= now &&
    new Date(b.end_time) > now
  );

  const getBookingsForSlot = (day: Date, hour: number) => {
    return roomBookings.filter(b => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const slotStart = setMinutes(setHours(day, hour), 0);
      const slotEnd = setMinutes(setHours(day, hour + 1), 0);
      return start < slotEnd && end > slotStart;
    });
  };

  const isBookingStart = (booking: BookingWithProfile, day: Date, hour: number) => {
    const start = new Date(booking.start_time);
    return isSameDay(start, day) && start.getHours() === hour;
  };

  return (
    <MainLayout title="Programări Săli" description="Rezervă sala de conferințe sau biblioteca">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Rezervare nouă
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Rezervare nouă</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Sala</Label>
                  <Select value={newRoom} onValueChange={setNewRoom}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROOMS.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.icon} {r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Titlu / Scop</Label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Ședință de lucru" />
                </div>
                <div>
                  <Label>Descriere (opțional)</Label>
                  <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Detalii suplimentare..." rows={2} />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ora început</Label>
                    <div className="flex gap-1">
                      <Select value={newStartHour} onValueChange={setNewStartHour}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map(h => (
                            <SelectItem key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={newStartMin} onValueChange={setNewStartMin}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['00', '15', '30', '45'].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Ora sfârșit</Label>
                    <div className="flex gap-1">
                      <Select value={newEndHour} onValueChange={setNewEndHour}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map(h => (
                            <SelectItem key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={newEndMin} onValueChange={setNewEndMin}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['00', '15', '30', '45'].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Anulează</Button>
                </DialogClose>
                <Button onClick={handleCreateBooking} disabled={submitting}>
                  {submitting ? 'Se salvează...' : 'Rezervă'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Room status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ROOMS.map(room => {
            const current = currentBooking(room.id);
            const isOccupied = !!current;
            return (
              <Card
                key={room.id}
                className={cn(
                  "cursor-pointer transition-all border-2",
                  selectedRoom === room.id ? "border-primary shadow-lg" : "border-transparent hover:border-border"
                )}
                onClick={() => setSelectedRoom(room.id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="text-3xl">{room.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{room.label}</h3>
                    {isOccupied ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                        </span>
                        <span className="text-sm text-red-600 dark:text-red-400 font-medium truncate">
                          Ocupată — {current.title}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                        </span>
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">Liberă acum</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Weekly calendar */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                {currentRoom.icon} {currentRoom.label}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                  Azi
                </Button>
                <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(weekDays[0], 'd MMMM', { locale: ro })} — {format(weekDays[4], 'd MMMM yyyy', { locale: ro })}
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {/* Desktop week grid */}
            <div className="hidden md:block min-w-[700px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-16 p-2 text-xs text-muted-foreground font-medium border-b border-r" />
                    {weekDays.map(day => (
                      <th key={day.toISOString()} className={cn(
                        "p-2 text-center border-b text-sm font-medium",
                        isSameDay(day, new Date()) && "bg-primary/5"
                      )}>
                        <div className="text-muted-foreground">{format(day, 'EEE', { locale: ro })}</div>
                        <div className={cn(
                          "text-lg font-bold",
                          isSameDay(day, new Date()) && "text-primary"
                        )}>{format(day, 'd')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour}>
                      <td className="p-1 text-xs text-muted-foreground text-right border-r align-top font-mono">
                        {String(hour).padStart(2, '0')}:00
                      </td>
                      {weekDays.map(day => {
                        const slotBookings = getBookingsForSlot(day, hour);
                        const isToday = isSameDay(day, new Date());
                        return (
                          <td
                            key={day.toISOString()}
                            className={cn(
                              "border-b border-r p-0.5 h-12 align-top relative",
                              isToday && "bg-primary/[0.02]"
                            )}
                          >
                            {slotBookings.map(booking => {
                              if (!isBookingStart(booking, day, hour)) return null;
                              const start = new Date(booking.start_time);
                              const end = new Date(booking.end_time);
                              const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                              const isOwn = booking.booked_by === user?.id;
                              return (
                                <div
                                  key={booking.id}
                                  className={cn(
                                    "absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 text-xs overflow-hidden z-10 border",
                                    isOwn
                                      ? "bg-primary/15 border-primary/30 text-primary"
                                      : "bg-muted border-border text-foreground/80"
                                  )}
                                  style={{ height: `${Math.max(durationHours * 48 - 4, 20)}px` }}
                                  title={`${booking.title} — ${booking.profile_name}\n${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`}
                                >
                                  <div className="font-medium truncate leading-tight">{booking.title}</div>
                                  <div className="text-[10px] opacity-70 truncate">{booking.profile_name}</div>
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: list view */}
            <div className="md:hidden p-4 space-y-3">
              {weekDays.map(day => {
                const dayBookings = roomBookings.filter(b => isSameDay(new Date(b.start_time), day));
                return (
                  <div key={day.toISOString()}>
                    <h4 className={cn(
                      "text-sm font-semibold mb-2",
                      isSameDay(day, new Date()) ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, 'EEEE, d MMMM', { locale: ro })}
                      {isSameDay(day, new Date()) && <Badge variant="secondary" className="ml-2 text-[10px]">Azi</Badge>}
                    </h4>
                    {dayBookings.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-2 pb-2">Nicio rezervare</p>
                    ) : (
                      <div className="space-y-2">
                        {dayBookings.map(b => {
                          const isOwn = b.booked_by === user?.id;
                          return (
                            <div key={b.id} className={cn(
                              "p-3 rounded-lg border flex items-start justify-between gap-2",
                              isOwn ? "bg-primary/5 border-primary/20" : "bg-muted/50"
                            )}>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{b.title}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(b.start_time), 'HH:mm')} - {format(new Date(b.end_time), 'HH:mm')}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {b.profile_name}
                                  </span>
                                </div>
                              </div>
                              {(isOwn || isSuperAdmin) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0"
                                  onClick={() => handleCancelBooking(b.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* My bookings */}
        {user && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Rezervările mele</CardTitle>
            </CardHeader>
            <CardContent>
              {bookings.filter(b => b.booked_by === user.id).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nu ai rezervări în această săptămână.</p>
              ) : (
                <div className="space-y-2">
                  {bookings
                    .filter(b => b.booked_by === user.id)
                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                    .map(b => {
                      const room = ROOMS.find(r => r.id === b.room);
                      return (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xl">{room?.icon}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{b.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(b.start_time), 'EEEE d MMM, HH:mm', { locale: ro })} - {format(new Date(b.end_time), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 flex-shrink-0"
                            onClick={() => handleCancelBooking(b.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default RoomBookings;
