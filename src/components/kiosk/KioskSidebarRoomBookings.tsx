import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DoorOpen } from 'lucide-react';

interface RoomBooking {
  id: string;
  room: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
}

const ROOMS = ['Sala de Conferințe', 'Bibliotecă'];

const formatHM = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
};

const KioskSidebarRoomBookings = () => {
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [now, setNow] = useState(new Date());

  // Keep "now" fresh so current/next detection updates even between fetches
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const fetchBookings = useCallback(async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const { data } = await supabase
      .from('room_bookings')
      .select('id, room, title, start_time, end_time, status')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true });

    if (data) setBookings(data);
  }, []);

  useEffect(() => {
    fetchBookings();
    const t = setInterval(fetchBookings, 30_000);
    return () => clearInterval(t);
  }, [fetchBookings]);

  return (
    <div className="p-5 shrink-0 overflow-hidden">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <DoorOpen className="w-3.5 h-3.5" /> Săli azi
      </h3>
      <div className="space-y-2.5">
        {ROOMS.map(room => {
          const roomBookings = bookings.filter(b => b.room === room);
          const currentBooking = roomBookings.find(b =>
            new Date(b.start_time) <= now && new Date(b.end_time) > now
          );
          const nextBookings = roomBookings.filter(b => new Date(b.start_time) > now).slice(0, 4);

          return (
            <div key={room} className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
              <p className="text-xs font-semibold text-slate-700 mb-2">{room}</p>

              {currentBooking ? (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                  <span className="text-xs text-red-600 font-medium">
                    Ocupat: {formatHM(currentBooking.start_time)}–{formatHM(currentBooking.end_time)}
                  </span>
                  {currentBooking.title && (
                    <span className="text-[10px] text-red-500 truncate max-w-[40%]">({currentBooking.title})</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs text-emerald-600 font-medium">Disponibil acum</span>
                </div>
              )}

              {nextBookings.length > 0 ? (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Urmează:</p>
                  <div className="space-y-1">
                    {nextBookings.map(b => (
                      <div key={b.id} className="flex items-center justify-between text-[11px]">
                        <span className="truncate max-w-[50%] text-slate-600 font-medium">{b.title}</span>
                        <span className="tabular-nums text-primary font-semibold">{formatHM(b.start_time)}–{formatHM(b.end_time)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !currentBooking && (
                <p className="text-[11px] text-slate-400 mt-1">Fără rezervări programate</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KioskSidebarRoomBookings;
