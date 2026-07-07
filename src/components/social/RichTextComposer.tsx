import { useRef, forwardRef, useImperativeHandle } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bold, Italic, Underline, Smile, List, Quote, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import MentionPickerButton from './MentionPickerButton';

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😮','😢','😡','👍','👎','🙏','👏','🎉','🔥','❤️','💯',
  '✅','❌','⭐','💡','🚀','📌','📎','📝','☕','🎂','🍕','🌟','⚡','🎯','💪','🙌','🤝','👀','🤯','😴',
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  minRows?: number;
  onSubmitKey?: () => void;
}

export interface RichTextComposerHandle {
  focus: () => void;
}

const RichTextComposer = forwardRef<RichTextComposerHandle, Props>(function RichTextComposer(
  { value, onChange, placeholder, maxLength = 10000, minRows = 4, onSubmitKey },
  ref,
) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
  }));

  const wrap = (before: string, after = before) => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || '';
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + selected.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const insert = (text: string) => {
    const el = taRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const insertLink = () => {
    const url = window.prompt('URL:');
    if (!url) return;
    const el = taRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const label = value.slice(start, end) || 'link';
    const next = value.slice(0, start) + `[${label}](${url})` + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-0.5 border border-border rounded-xl px-1.5 py-1 bg-muted/30">
        <ToolbarBtn onClick={() => wrap('**')} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => wrap('*')} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => wrap('__')} title="Underline"><Underline className="w-3.5 h-3.5" /></ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn onClick={() => insert('\n• ')} title="Listă"><List className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => insert('\n> ')} title="Citat"><Quote className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={insertLink} title="Link"><LinkIcon className="w-3.5 h-3.5" /></ToolbarBtn>
        <MentionPickerButton
          onPick={(p) => insert(`@[${p.full_name || 'Coleg'}](user:${p.user_id}) `)}
        />
        <div className="w-px h-4 bg-border mx-1" />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Emoji"
              className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-8 gap-1 text-xl">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insert(e)}
                  className="hover:bg-muted rounded p-0.5 leading-none"
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <Textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn('rounded-xl resize-y text-sm leading-relaxed')}
        style={{ minHeight: `${minRows * 24 + 16}px` }}
        onKeyDown={(e) => {
          if (onSubmitKey && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onSubmitKey();
          }
        }}
      />
    </div>
  );
});

function ToolbarBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  );
}

export default RichTextComposer;
