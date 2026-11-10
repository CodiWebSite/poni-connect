import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, Eye, Loader2, UserSearch } from 'lucide-react';
import { suggestEmployees, Candidate } from '@/utils/payslipSuggestions';

interface Slip {
  id: string;
  name_detected: string;
  marca_detected: string | null;
  match_status: string;
  match_notes: string | null;
  employee_epd_id: string | null;
  file_path: string | null;
}

interface Props {
  slips: Slip[];
  employees: Candidate[];
  busyId: string | null;
  previewingId: string | null;
  onAssign: (slipId: string, epdId: string) => void;
  onPreview: (slipId: string) => void;
}

const REASON: Record<string, string> = {
  needs_confirm: 'Potrivire aproximativă — confirmați persoana',
  unmatched: 'Nu s-a găsit persoana',
  duplicate_name: 'Mai mulți colegi cu același nume — alegeți după marcă',
};

export default function PayslipToResolve({ slips, employees, busyId, previewingId, onAssign, onPreview }: Props) {
  const todo = useMemo(() => slips.filter(s => ['needs_confirm', 'unmatched', 'duplicate_name'].includes(s.match_status)), [slips]);
  if (todo.length === 0) return null;

  return (
    <div className="mb-5 space-y-3">
      <div className="flex items-center gap-2">
        <UserSearch className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold">De rezolvat</h4>
        <Badge variant="secondary" className="text-[10px]">{todo.length}</Badge>
        <span className="text-xs text-muted-foreground hidden sm:inline">· apăsați pe persoana corectă</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {todo.map(s => {
          const current = employees.find(e => e.id === s.employee_epd_id);
          const sugg = suggestEmployees(s.name_detected, employees).filter(x => x.e.id !== current?.id);
          const busy = busyId === s.id;
          return (
            <div key={s.id} className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-4 shadow-sm space-y-3 animate-fade-in">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{s.name_detected}</div>
                  <div className="text-[11px] text-muted-foreground">Marcă {s.marca_detected ?? '—'} · {REASON[s.match_status]}</div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Vezi fluturașul"
                  disabled={!s.file_path || previewingId === s.id} onClick={() => onPreview(s.id)}>
                  {previewingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>

              {current && (
                <Button size="sm" className="w-full justify-between" disabled={busy} onClick={() => onAssign(s.id, current.id)}>
                  <span className="truncate">{current.last_name} {current.first_name}</span>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="inline-flex items-center gap-1"><Check className="w-4 h-4" /> Confirmă</span>}
                </Button>
              )}

              {sugg.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {current ? 'Alte variante' : 'Sugestii'}
                  </div>
                  {sugg.map(({ e, score }) => (
                    <button key={e.id} disabled={busy} onClick={() => onAssign(s.id, e.id)}
                      className="w-full flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-left text-sm hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50">
                      <span className="truncate">{e.last_name} {e.first_name}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(score * 100)}%</span>
                    </button>
                  ))}
                </div>
              ) : !current && (
                <div className="text-xs text-muted-foreground">Nicio sugestie — alegeți din tabelul de mai jos.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
