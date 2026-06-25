import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronRight, ArrowUpDown, EyeOff, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Colleague {
  id: string;
  user_id: string | null;
  full_name: string;
  position: string;
  avatar_url: string | null;
}

const Colleagues = () => {
  const [items, setItems] = useState<Colleague[]>([]);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('employee_directory')
        .select('id, user_id, full_name, position, avatar_url')
        .order('full_name', { ascending: true });
      setItems(
        (data || []).map((d) => ({
          id: d.id || '',
          user_id: d.user_id,
          full_name: d.full_name || '—',
          position: d.position || '',
          avatar_url: d.avatar_url,
        }))
      );
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter(
      (c) =>
        !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) =>
      sortAsc ? a.full_name.localeCompare(b.full_name) : b.full_name.localeCompare(a.full_name)
    );
  }, [items, search, sortAsc]);

  return (
    <SocialLayout title="Colegi de muncă" description="Directorul angajaților ICMPP">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Caută angajat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 rounded-2xl bg-card border-border"
            />
          </div>
          <Button
            variant="secondary"
            className="h-12 rounded-2xl px-5"
            onClick={() => setHidden((v) => !v)}
          >
            {hidden ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Arată toată compania
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Ascunde toată compania
              </>
            )}
          </Button>
        </div>

        {!hidden && (
          <Card className="rounded-2xl border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto] items-center px-6 py-4 border-b border-border bg-muted/20">
              <button
                onClick={() => setSortAsc((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Nume
                <ArrowUpDown className="w-3 h-3" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Funcție
              </span>
              <span className="w-5" />
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Se încarcă…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Niciun rezultat
              </div>
            ) : (
              <ul>
                {filtered.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={c.user_id ? `/profil/${c.user_id}` : '#'}
                      className="grid grid-cols-[1fr_1fr_auto] items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt={c.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-primary">
                              {c.full_name.split(' ').map((s) => s[0]).join('').substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium">{c.full_name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{c.position || '—'}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </SocialLayout>
  );
};

export default Colleagues;
