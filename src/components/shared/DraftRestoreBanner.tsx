import { Button } from '@/components/ui/button';
import { History, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { FormDraft } from '@/hooks/useFormDraft';

interface DraftRestoreBannerProps<T extends Record<string, unknown>> {
  draft: FormDraft<T>;
  onRestore: (data: T) => void;
  label?: string;
}

/** Bandă „Reia ce ai completat" pentru formularele lungi. */
export function DraftRestoreBanner<T extends Record<string, unknown>>({
  draft,
  onRestore,
  label = 'Ai un formular necompletat, salvat automat',
}: DraftRestoreBannerProps<T>) {
  if (!draft.hasDraft || !draft.data) return null;

  return (
    <div className="p-3 rounded-lg bg-info/10 border border-info/30 text-sm flex flex-wrap items-center gap-2">
      <History className="w-4 h-4 flex-shrink-0 text-info" />
      <span className="flex-1 min-w-[180px]">
        {label}
        {draft.savedAt && (
          <span className="text-muted-foreground">
            {' '}
            ({formatDistanceToNow(draft.savedAt, { addSuffix: true, locale: ro })})
          </span>
        )}
      </span>
      <Button size="sm" variant="secondary" onClick={() => onRestore(draft.data as T)}>
        Reia completarea
      </Button>
      <Button size="sm" variant="ghost" onClick={draft.clear} aria-label="Renunță la ciornă">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
