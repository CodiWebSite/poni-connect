import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Plus, DoorOpen, Clock, CalendarDays, Pencil, Trash2, User, X } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

type RoomBooking = {
  id: string;
  room: string;
  title: string;
  description?: string | null;
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
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RoomBooking | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      .select('id, room, title, description, start_time, end_time, booked_by')
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
      if (profiles) profiles.forEach(p => { profileMap[p.user_id] = p.full_name; });
    }

    setBookings((data || []).map(b => ({
      ...b,
      profile_name: profileMap[b.booked_by] || 'Necunoscut',
    })));
    setLoading(false);
  };

  const now = new Date();

  const getCurrentBooking = (roomId: string) =>
    bookings.find(b => b.room === roomId && new Date(b.start_time) <= now && new Date(b.end_time) > now);

  const getNextBooking = (roomId: string) =>
    bookings
      .filter(b => b.room === roomId && new Date(b.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  const openDetails = (b: RoomBooking) => {
    setSelected(b);
    setEditing(false);
    setEditTitle(b.title);
    setEditDescription(b.description || '');
    setEditStart(format(new Date(b.start_time), "yyyy-MM-dd'T'HH:mm"));
    setEditEnd(format(new Date(b.end_time), "yyyy-MM-dd'T'HH:mm"));
  };

  const canManage = selected && user && (selected.booked_by === user.id || isSuperAdmin);

  const handleSave = async () => {
    if (!selected) return;
    if (!editTitle.trim()) {
      toast({ title: 'Eroare', description: 'Titlul este obligatoriu.', variant: 'destructive' });
      return;
    }
    const startISO = new Date(editStart).toISOString();
    const endISO = new Date(editEnd).toISOString();
    if (new Date(endISO) <= new Date(startISO)) {
      toast({ title: 'Eroare', description: 'Ora de sfârșit trebuie să fie după ora de început.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('room_bookings')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        start_time: startISO,
        end_time: endISO,
      })
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Salvat', description: 'Rezervarea a fost actualizată.' });
    setEditing(false);
    setSelected(null);
    fetchBookings();
  };

  const handleDelete = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from('room_bookings')
      .update({ status: 'cancelled' })
      .eq('id', selected.id);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Șters', description: 'Rezervarea a fost anulată.' });
    setConfirmDelete(false);
    setSelected(null);
    fetchBookings();
  };

  return (
    <>
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
              const activeBooking = current || next;

              return (
                <div
                  key={room.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    isOccupied ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20",
                    activeBooking && "cursor-pointer hover:bg-opacity-80"
                  )}
                  onClick={() => activeBooking && openDetails(activeBooking)}
                  role={activeBooking ? 'button' : undefined}
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
                  <Link to="/room-bookings" onClick={(e) => e.stopPropagation()}>
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

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setEditing(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editare rezervare' : 'Detalii rezervare'}</DialogTitle>
            <DialogDescription>
              {selected && ROOMS.find(r => r.id === selected.room)?.label}
            </DialogDescription>
          </DialogHeader>

          {selected && !editing && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Titlu</p>
                <p className="font-medium">{selected.title}</p>
              </div>
              {selected.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Descriere</p>
                  <p className="whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Început</p>
                  <p className="font-medium">{format(new Date(selected.start_time), 'd MMM, HH:mm', { locale: ro })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sfârșit</p>
                  <p className="font-medium">{format(new Date(selected.end_time), 'd MMM, HH:mm', { locale: ro })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span className="text-xs">Rezervat de <span className="font-medium text-foreground">{selected.profile_name}</span></span>
              </div>
            </div>
          )}

          {selected && editing && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit-title">Titlu</Label>
                <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-desc">Descriere</Label>
                <Textarea id="edit-desc" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-start">Început</Label>
                  <Input id="edit-start" type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit-end">Sfârșit</Label>
                  <Input id="edit-end" type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {canManage && !editing && (
              <>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Șterge
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editează
                </Button>
              </>
            )}
            {editing && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="w-3.5 h-3.5 mr-1" /> Anulează
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Se salvează...' : 'Salvează'}
                </Button>
              </>
            )}
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Închide</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulezi rezervarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune va anula rezervarea. Sala va deveni disponibilă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Renunță</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Confirmă anularea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
