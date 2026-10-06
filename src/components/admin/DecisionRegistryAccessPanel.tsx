import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollText, Loader2, Trash2, UserPlus } from 'lucide-react';

interface P { user_id: string; full_name: string; department: string | null }

const DecisionRegistryAccessPanel = () => {
  const { toast } = useToast();
  const [members, setMembers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [a, p] = await Promise.all([
      supabase.from('decision_registry_access').select('user_id'),
      supabase.from('profiles').select('user_id, full_name, department').order('full_name'),
    ]);
    setMembers((a.data || []).map((r: any) => r.user_id));
    setProfiles((p.data || []) as P[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async (uid: string) => {
    setBusy(uid);
    const { error } = await supabase.from('decision_registry_access').insert({ user_id: uid });
    setBusy(null);
    if (error) return toast({ title: 'Nu s-a putut adăuga', description: error.message, variant: 'destructive' });
    toast({ title: 'Acces acordat' });
    load();
  };
  const remove = async (uid: string) => {
    if (!confirm('Retragi accesul la Registrul de Decizii?')) return;
    setBusy(uid);
    const { error } = await supabase.from('decision_registry_access').delete().eq('user_id', uid);
    setBusy(null);
    if (error) return toast({ title: 'Nu s-a putut retrage', description: error.message, variant: 'destructive' });
    toast({ title: 'Acces retras' });
    load();
  };

  const byId = new Map(profiles.map((p) => [p.user_id, p]));
  const results = q.trim().length < 2 ? [] : profiles
    .filter((p) => !members.includes(p.user_id) && p.full_name?.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ScrollText className="w-5 h-5" />Acces Registru Decizii</CardTitle>
        <CardDescription>Persoanele de aici pot vedea, edita și descărca registrul. Super-adminii au acces mereu.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <>
            <div className="space-y-2">
              {members.length === 0 && <p className="text-sm text-muted-foreground">Nicio persoană în listă.</p>}
              {members.map((uid) => {
                const p = byId.get(uid);
                return (
                  <div key={uid} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{p?.full_name || 'Utilizator necunoscut'}</p>
                      {p?.department && <p className="text-xs text-muted-foreground">{p.department}</p>}
                    </div>
                    <Button size="sm" variant="ghost" disabled={busy === uid} onClick={() => remove(uid)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <Input placeholder="Caută o persoană după nume pentru a-i da acces…" value={q} onChange={(e) => setQ(e.target.value)} />
              {results.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between rounded-lg border p-2">
                  <div>
                    <p className="text-sm font-medium">{p.full_name}</p>
                    {p.department && <p className="text-xs text-muted-foreground">{p.department}</p>}
                  </div>
                  <Button size="sm" disabled={busy === p.user_id} onClick={() => add(p.user_id)}>
                    <UserPlus className="w-4 h-4 mr-1" />Adaugă
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DecisionRegistryAccessPanel;
