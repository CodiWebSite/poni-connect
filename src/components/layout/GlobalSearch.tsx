import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Search, FileText, Megaphone, Users, Calendar, X,
  BookOpen, Lightbulb, Boxes, Inbox, Archive, DoorOpen, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ResultType =
  | 'announcement'
  | 'document'
  | 'employee'
  | 'event'
  | 'library'
  | 'magazine'
  | 'suggestion'
  | 'equipment'
  | 'archive'
  | 'room';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: ResultType;
  url: string;
}

const typeMeta: Record<ResultType, { icon: any; label: string; color: string }> = {
  announcement: { icon: Megaphone, label: 'Anunț', color: 'bg-primary/10 text-primary' },
  document: { icon: FileText, label: 'Document', color: 'bg-accent/10 text-accent' },
  employee: { icon: Users, label: 'Angajat', color: 'bg-info/10 text-info' },
  event: { icon: Calendar, label: 'Eveniment', color: 'bg-success/10 text-success' },
  library: { icon: BookOpen, label: 'Carte', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  magazine: { icon: BookOpen, label: 'Revistă', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  suggestion: { icon: Lightbulb, label: 'Sugestie', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  equipment: { icon: Boxes, label: 'Echipament', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
  archive: { icon: Archive, label: 'Arhivă', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  room: { icon: DoorOpen, label: 'Rezervare sală', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
};

// Escape PostgREST or() reserved characters
const esc = (s: string) => s.replace(/[%,()]/g, ' ').trim();

export const GlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ⌘K / Ctrl+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.matchMedia('(min-width: 768px)').matches) {
          const input = wrapperRef.current?.querySelector('input');
          (input as HTMLInputElement | null)?.focus();
          setShowResults(true);
        } else {
          setMobileOpen(true);
        }
      }
      if (e.key === 'Escape') {
        setShowResults(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const q = esc(query);
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      const like = `%${q}%`;

      // All queries run in parallel. RLS automatically restricts results
      // per role/department/GDPR — we never bypass it on the client.
      const [
        annR, docR, empR, evtR, libR, magR, sugR, eqR, regR, arcR, roomR,
      ] = await Promise.all([
        supabase.from('announcements').select('id, title, content').or(`title.ilike.${like},content.ilike.${like}`).limit(4),
        supabase.from('documents').select('id, name, description').or(`name.ilike.${like},description.ilike.${like}`).limit(4),
        supabase.from('employee_directory').select('id, full_name, department, position').or(`full_name.ilike.${like},department.ilike.${like},position.ilike.${like}`).limit(5) as any,
        supabase.from('events').select('id, title, description').or(`title.ilike.${like},description.ilike.${like}`).limit(4),
        supabase.from('library_books').select('id, titlu, autor, cota').or(`titlu.ilike.${like},autor.ilike.${like},cota.ilike.${like}`).limit(4),
        supabase.from('library_magazines').select('id, titlu, an, volum, numar').ilike('titlu', like).limit(3),
        supabase.from('suggestions').select('id, title, description').or(`title.ilike.${like},description.ilike.${like}`).limit(3),
        supabase.from('equipment_items').select('id, name, serial_number, inventory_number, brand_model').or(`name.ilike.${like},serial_number.ilike.${like},inventory_number.ilike.${like},brand_model.ilike.${like}`).limit(4),
        supabase.from('registry_entries').select('id, official_number, year, series_key, subject, sender, recipient').or(`subject.ilike.${like},sender.ilike.${like},recipient.ilike.${like}`).limit(4),
        supabase.from('archive_documents').select('id, file_name, description, registration_number, department').or(`file_name.ilike.${like},description.ilike.${like},registration_number.ilike.${like}`).limit(3),
        supabase.from('room_bookings').select('id, title, room, description, start_time').or(`title.ilike.${like},room.ilike.${like},description.ilike.${like}`).limit(3),
      ]);

      const merged: SearchResult[] = [];

      (annR.data || []).forEach((a: any) => merged.push({
        id: a.id, title: a.title,
        description: a.content ? String(a.content).substring(0, 110) + '…' : undefined,
        type: 'announcement', url: '/announcements',
      }));
      (docR.data || []).forEach((d: any) => merged.push({
        id: d.id, title: d.name, description: d.description || undefined,
        type: 'document', url: '/documents',
      }));
      (empR.data || []).forEach((e: any) => merged.push({
        id: e.id, title: e.full_name,
        description: [e.position, e.department].filter(Boolean).join(' • '),
        type: 'employee', url: '/my-team',
      }));
      (evtR.data || []).forEach((e: any) => merged.push({
        id: e.id, title: e.title, description: e.description || undefined,
        type: 'event', url: '/calendar',
      }));
      (libR.data || []).forEach((b: any) => merged.push({
        id: b.id, title: b.titlu,
        description: [b.autor, b.cota ? `cota ${b.cota}` : null].filter(Boolean).join(' • '),
        type: 'library', url: '/library',
      }));
      (magR.data || []).forEach((m: any) => merged.push({
        id: m.id, title: m.titlu,
        description: [m.an && `an ${m.an}`, m.volum && `vol. ${m.volum}`, m.numar && `nr. ${m.numar}`].filter(Boolean).join(' • '),
        type: 'magazine', url: '/library',
      }));
      (sugR.data || []).forEach((s: any) => merged.push({
        id: s.id, title: s.title, description: s.description || undefined,
        type: 'suggestion', url: '/suggestions',
      }));
      (eqR.data || []).forEach((e: any) => merged.push({
        id: e.id, title: e.name,
        description: [e.brand_model, e.inventory_number && `inv. ${e.inventory_number}`, e.serial_number && `SN ${e.serial_number}`].filter(Boolean).join(' • '),
        type: 'equipment', url: '/inventory',
      }));
      (regR.data || []).forEach((r: any) => merged.push({
        id: r.id,
        title: `${r.series_key || ''}-${r.year || ''}-${r.official_number || ''} ${r.subject ? '· ' + r.subject : ''}`.trim(),
        description: [r.sender && `de la ${r.sender}`, r.recipient && `către ${r.recipient}`].filter(Boolean).join(' • '),
        type: 'registry', url: '/registratura',
      }));
      (arcR.data || []).forEach((a: any) => merged.push({
        id: a.id, title: a.file_name || a.registration_number,
        description: [a.registration_number, a.department, a.description].filter(Boolean).join(' • '),
        type: 'archive', url: '/archive',
      }));
      (roomR.data || []).forEach((r: any) => merged.push({
        id: r.id,
        title: `${r.title || 'Rezervare'} — ${r.room || ''}`.trim(),
        description: r.start_time ? new Date(r.start_time).toLocaleString('ro-RO') : undefined,
        type: 'room', url: '/room-bookings',
      }));

      setResults(merged);
      setLoading(false);
    }, 280);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const grouped = useMemo(() => {
    const g: Record<string, SearchResult[]> = {};
    results.forEach(r => {
      (g[r.type] ||= []).push(r);
    });
    return g;
  }, [results]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url);
    setQuery('');
    setShowResults(false);
    setMobileOpen(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const SearchResultsList = () => {
    const order: ResultType[] = [
      'announcement','event','employee','document','registry','archive',
      'library','magazine','equipment','room','suggestion',
    ];

    if (loading && results.length === 0) {
      return (
        <div className="p-6 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Căutare…
        </div>
      );
    }
    if (!loading && results.length === 0 && query.length >= 2) {
      return (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Nu s-au găsit rezultate pentru „{query}"
        </div>
      );
    }
    if (results.length === 0) return null;

    return (
      <div className="py-1">
        {order.filter(t => grouped[t]?.length).map(type => {
          const meta = typeMeta[type];
          const Icon = meta.icon;
          return (
            <div key={type} className="py-1">
              <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                {meta.label}
              </div>
              {grouped[type].map(result => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    meta.color,
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate text-sm">{result.title}</p>
                    {result.description && (
                      <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          );
        })}
        <div className="px-4 py-2 text-[10px] text-muted-foreground/60 border-t border-border/50 mt-1">
          Rezultatele sunt filtrate automat conform rolului tău și politicilor GDPR.
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Search */}
      <div ref={wrapperRef} className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Caută anunțuri, documente, angajați, cărți…"
          className="pl-10 pr-16 w-80 bg-secondary/50"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
        />
        {query ? (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Șterge"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <kbd className="hidden lg:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-background/60 text-muted-foreground pointer-events-none">
            ⌘K
          </kbd>
        )}

        {showResults && query.length >= 2 && (
          <div className="absolute top-full mt-2 w-[28rem] bg-card border border-border rounded-lg shadow-lg z-50 max-h-[32rem] overflow-y-auto">
            <SearchResultsList />
          </div>
        )}
      </div>

      {/* Mobile Search Button + Dialog */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Search className="w-5 h-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Căutare</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Caută în toată platforma…"
                className="pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto -mx-6">
              <SearchResultsList />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
