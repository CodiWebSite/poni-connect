import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pin, Paperclip, Link2, Pencil, Trash2, ExternalLink, FileImage, FileText as FileTextIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinkItem {
  label: string;
  url: string;
}

interface AttachmentItem {
  name: string;
  url: string;
  type: string;
}

interface AnnouncementCardProps {
  id?: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isPinned: boolean;
  createdAt: string;
  author?: string;
  attachments?: AttachmentItem[];
  links?: LinkItem[];
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

const priorityConfig = {
  low: { label: 'Scăzut', className: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', className: 'bg-info/10 text-info' },
  high: { label: 'Important', className: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
};

const isImage = (type: string) => type.startsWith('image/');

const AnnouncementCard = ({
  title, content, priority, isPinned, createdAt, author,
  attachments = [], links = [], canEdit, onEdit, onDelete, compact
}: AnnouncementCardProps) => {
  const config = priorityConfig[priority];

  return (
    <div className={cn(
      "bg-card rounded-xl border border-border hover:shadow-md transition-all duration-200",
      isPinned && "ring-2 ring-primary/20",
      compact ? "p-3" : "p-5"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isPinned && <Pin className="w-3.5 h-3.5 text-primary fill-primary" />}
            <Badge className={config.className} variant="secondary">{config.label}</Badge>
          </div>
          <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</h3>
          <p className={cn("text-muted-foreground whitespace-pre-line mt-1", compact ? "text-xs" : "text-sm")}>{content}</p>
        </div>

        {canEdit && !compact && (
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Image attachments preview */}
      {!compact && attachments.filter(a => isImage(a.type)).length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {attachments.filter(a => isImage(a.type)).map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={att.url} alt={att.name} className="h-24 rounded-lg border border-border object-cover hover:opacity-80 transition-opacity" />
            </a>
          ))}
        </div>
      )}

      {/* File attachments */}
      {!compact && attachments.filter(a => !isImage(a.type)).length > 0 && (
        <div className="mt-3 space-y-1">
          {attachments.filter(a => !isImage(a.type)).map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary hover:underline bg-muted/40 rounded px-2 py-1.5">
              <Paperclip className="w-3 h-3" />
              {att.name}
              <ExternalLink className="w-3 h-3 ml-auto" />
            </a>
          ))}
        </div>
      )}

      {/* Links */}
      {!compact && links.length > 0 && (
        <div className="mt-3 space-y-1">
          {links.map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary hover:underline bg-primary/5 rounded px-2 py-1.5">
              <Link2 className="w-3 h-3" />
              {link.label}
              <ExternalLink className="w-3 h-3 ml-auto" />
            </a>
          ))}
        </div>
      )}

      {/* Compact mode: show attachment/link counts */}
      {compact && (attachments.length > 0 || links.length > 0) && (
        <div className="flex gap-3 mt-2">
          {attachments.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Paperclip className="w-3 h-3" /> {attachments.length}
            </span>
          )}
          {links.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Link2 className="w-3 h-3" /> {links.length}
            </span>
          )}
        </div>
      )}

      <div className={cn("flex items-center justify-between border-t border-border", compact ? "mt-2 pt-2" : "mt-4 pt-4")}>
        <span className="text-xs text-muted-foreground">
          {format(new Date(createdAt), compact ? 'dd MMM' : 'dd MMM yyyy', { locale: ro })}
        </span>
        {author && <span className="text-xs text-muted-foreground">{author}</span>}
      </div>
    </div>
  );
};

export default AnnouncementCard;
