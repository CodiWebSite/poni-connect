import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { AtSign, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  onPick: (p: Profile) => void;
}

const MentionPickerButton = ({ onPick }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<Profile[]>([]);

  useEffect(() => {
    if (!open || all.length) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .order('full_name');
      setAll((data ?? []) as Profile[]);
    })();
  }, [open, all.length]);

  const q = query.trim().toLowerCase();
  const filtered = (q
    ? all.filter((p) => (p.full_name || '').toLowerCase().includes(q))
    : all
  ).slice(0, 30);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Mențiune @coleg"
          className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <AtSign className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută coleg"
            className="pl-8 h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Niciun rezultat</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.user_id}
                type="button"
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-muted text-left"
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[9px] font-semibold text-primary">
                      {(p.full_name || '?').substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs truncate">{p.full_name || 'Coleg'}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MentionPickerButton;
