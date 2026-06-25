import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, Lock, ChevronDown, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DirectoryUser {
  user_id: string;
  full_name: string;
  position: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

const CreateCommunityDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setVisibility('public');
    setSelected(new Set());
    setSearch('');
    (async () => {
      const { data } = await supabase
        .from('employee_directory')
        .select('user_id, full_name, position')
        .order('full_name', { ascending: true });
      setUsers(
        (data || [])
          .filter((d): d is DirectoryUser => !!d.user_id)
          .map((d) => ({
            user_id: d.user_id as string,
            full_name: d.full_name || '—',
            position: d.position,
          }))
      );
    })();
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.full_name.toLowerCase().includes(q) || (u.position || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Numele este obligatoriu');
      return;
    }
    if (description.length > 100) {
      toast.error('Descrierea poate avea maxim 100 caractere');
      return;
    }
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Nu sunteți autentificat');

      const baseSlug = slugify(name) || `comunitate-${Date.now()}`;
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: community, error } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          slug,
          description: description.trim() || null,
          visibility,
          created_by: uid,
        })
        .select('id')
        .single();
      if (error) throw error;

      const memberIds = Array.from(selected).filter((id) => id !== uid);
      if (memberIds.length > 0) {
        const rows = memberIds.map((user_id) => ({
          community_id: community.id,
          user_id,
          role: 'member' as const,
        }));
        const { error: mErr } = await supabase.from('community_members').insert(rows);
        if (mErr) console.warn('Adăugare membri eșuată:', mErr.message);
      }

      toast.success('Comunitate creată');
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || 'Eroare la creare');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedUsers = users.filter((u) => selected.has(u.user_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-2xl">
            Creează comunitate
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <Input
            placeholder="Nume"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl h-12"
          />

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Alege membrii comunității
            </label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full min-h-12 rounded-xl border border-input bg-background px-3 py-2 text-left flex items-center justify-between gap-2 hover:border-ring transition-colors"
                >
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {selectedUsers.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Selectează membri…</span>
                    ) : (
                      selectedUsers.slice(0, 6).map((u) => (
                        <Badge
                          key={u.user_id}
                          variant="secondary"
                          className="rounded-full gap-1 pr-1"
                        >
                          {u.full_name}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(u.user_id);
                            }}
                            className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                    {selectedUsers.length > 6 && (
                      <Badge variant="secondary" className="rounded-full">
                        +{selectedUsers.length - 6}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl" align="start">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Caută colegi…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-1">
                    {filtered.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-4 text-center">
                        Niciun rezultat
                      </div>
                    ) : (
                      filtered.map((u) => {
                        const checked = selected.has(u.user_id);
                        return (
                          <button
                            key={u.user_id}
                            type="button"
                            onClick={() => toggle(u.user_id)}
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm hover:bg-accent ${
                              checked ? 'bg-accent' : ''
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                                checked
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-input'
                              }`}
                            >
                              {checked ? '✓' : ''}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium">{u.full_name}</div>
                              {u.position && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {u.position}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <Textarea
            placeholder="Descriere comunitate (maxim 100 caractere)"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 100))}
            className="rounded-xl min-h-24 resize-none"
            maxLength={100}
          />

          <div>
            <p className="text-sm font-semibold mb-2">Alege vizibilitatea</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={visibility === 'public' ? 'default' : 'outline'}
                onClick={() => setVisibility('public')}
                className="rounded-xl"
              >
                <Globe className="w-4 h-4 mr-1.5" />
                Public
              </Button>
              <Button
                type="button"
                variant={visibility === 'private' ? 'default' : 'outline'}
                onClick={() => setVisibility('private')}
                className="rounded-xl"
              >
                <Lock className="w-4 h-4 mr-1.5" />
                Privat
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {visibility === 'public'
                ? 'Oricine se poate alătura și poate vedea cine face parte din grup. Vizibilitatea grupului poate fi schimbată oricând ulterior.'
                : 'Doar membrii invitați pot vedea conținutul și lista de membri.'}
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="w-full rounded-xl h-12 text-base font-semibold"
          >
            {submitting ? 'Se creează…' : 'Creează comunitate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCommunityDialog;
