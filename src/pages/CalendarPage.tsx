import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Plus, Clock, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ro } from 'date-fns/locale';

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
}

const CalendarPage = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { canManageContent } = useUserRole();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    start_date: '',
    start_time: '',
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    if (data) {
      setEvents(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);

    const startDateTime = new Date(`${formData.start_date}T${formData.start_time || '09:00'}`);

    const { error } = await supabase
      .from('events')
      .insert({
        title: formData.title,
        description: formData.description || null,
        location: formData.location || null,
        start_date: startDateTime.toISOString(),
        created_by: user.id,
      });

    if (error) {
      toast.error('Eroare la adăugarea evenimentului');
    } else {
      toast.success('Eveniment adăugat cu succes');
      setIsOpen(false);
      setFormData({ title: '', description: '', location: '', start_date: '', start_time: '' });
      fetchEvents();
    }
    
    setIsLoading(false);
  };

  const eventsForSelectedDate = selectedDate
    ? events.filter((event) => isSameDay(new Date(event.start_date), selectedDate))
    : [];

  const eventDates = events.map((event) => new Date(event.start_date));

  return (
    <MainLayout title="Calendar" description="Evenimente și programări">
      {canManageContent && (
        <div className="flex justify-end mb-6">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Eveniment nou
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Adaugă eveniment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titlu</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descriere</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Locație</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time">Ora</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Se salvează...' : 'Salvează'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl p-4 border border-border">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ro}
              modifiers={{
                hasEvent: eventDates,
              }}
              modifiersStyles={{
                hasEvent: {
                  backgroundColor: 'hsl(var(--primary) / 0.1)',
                  fontWeight: 'bold',
                },
              }}
              className="rounded-md"
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">
                {selectedDate
                  ? format(selectedDate, "EEEE, d MMMM yyyy", { locale: ro })
                  : 'Selectează o dată'}
              </h3>
            </div>
            
            <div className="p-4">
              {eventsForSelectedDate.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nu există evenimente pentru această dată</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {eventsForSelectedDate.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <h4 className="font-semibold text-foreground mb-2">{event.title}</h4>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(event.start_date), 'HH:mm')}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CalendarPage;
