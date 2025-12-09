import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Pin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnnouncementCardProps {
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isPinned: boolean;
  createdAt: string;
  author?: string;
}

const priorityConfig = {
  low: { label: 'Scăzut', className: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', className: 'bg-info/10 text-info' },
  high: { label: 'Important', className: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
};

const AnnouncementCard = ({ title, content, priority, isPinned, createdAt, author }: AnnouncementCardProps) => {
  const config = priorityConfig[priority];

  return (
    <div className={cn(
      "bg-card rounded-xl p-5 border border-border hover:shadow-md transition-all duration-200",
      isPinned && "ring-2 ring-primary/20"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {isPinned && (
              <Pin className="w-4 h-4 text-primary fill-primary" />
            )}
            <Badge className={config.className} variant="secondary">
              {config.label}
            </Badge>
          </div>
          <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{content}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground">
          {format(new Date(createdAt), 'dd MMM yyyy', { locale: ro })}
        </span>
        {author && (
          <span className="text-xs text-muted-foreground">{author}</span>
        )}
      </div>
    </div>
  );
};

export default AnnouncementCard;
