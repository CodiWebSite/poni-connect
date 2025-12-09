import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Calendar, MapPin, Clock } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  location?: string;
}

interface UpcomingEventsProps {
  events: CalendarEvent[];
}

const UpcomingEvents = ({ events }: UpcomingEventsProps) => {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Evenimente viitoare</h3>
        <Calendar className="w-5 h-5 text-muted-foreground" />
      </div>
      
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nu există evenimente programate
        </p>
      ) : (
        <div className="space-y-3">
          {events.slice(0, 4).map((event) => (
            <div
              key={event.id}
              className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <h4 className="font-medium text-sm text-foreground mb-2 line-clamp-1">
                {event.title}
              </h4>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(event.startDate), 'dd MMM, HH:mm', { locale: ro })}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {event.location}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingEvents;
