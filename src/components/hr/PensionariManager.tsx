import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, UserMinus, Search, Award } from 'lucide-react';

interface Row {
  user_id: string;
  full_name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  is_pensionar: boolean;
  role_id?: string;
}

const PensionariManager = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showOnlyPensionari, setShowOnlyPensionari] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, department, position'),
      supabase.from('user_roles').select('id, user_id, role'),
    ]);

    // fetch emails via auth.users indirectly — profiles doesn't hold email; try employee_personal_data
    const { data: epd } = await supabase
      .from('employee_personal_data')
      .select('email, employee_record_id, first_name, last_name');
    const { data: recs } = await supabase.from('employee_records').select('id, user_id');

    const emailByUser: Record<string, string> = {};
    (recs || []).forEach((r: any) => {
      const match = (epd || []).find((e: any) => e.employee_record_id === r.id);
      if (match?.email && r.user_id) emailByUser[r.user_id] = match.email;
    });

    const pensionarRoleByUser: Record<string, string> = {};
    (roles || []).forEach((r: any) => {
      if (r.role === 'pensionar_colaborator') pensionarRoleByUser[r.user_id] = r.id;
    });

    const list: Row[] = (profiles || []).map((p: any) => ({
      user_id: p.user_id,
      full_name: p.full_name || '—',
      email: emailByUser[p.user_id] || null,
      department: p.department,
      position: p.position,
      is_pensionar: !!pensionarRoleByUser[p.user_id],
      role_id: pensionarRoleByUser[p.user_id],
    }));
    list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ro'));
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setPensionar = async (row: Row, enabled: boolean) => {
    setBusy(row.user_id);
    try {
      if (enabled) {
        // Remove existing non-pensionar role (single role per user), then insert pensionar
        const { data: existing } = await supabase
          .from('user_roles').select('id').eq('user_id', row.user_id);
        if (existing && existing.length > 0) {
          await supabase.from('user_roles').delete().eq('user_id', row.user_id);
        }
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: row.user_id, role: 'pensionar_colaborator' as any });
        if (error) throw error;
        toast({ title: 'Marcat ca pensionar colaborator', description: row.full_name });
      } else {
        // Remove pensionar role → revert to 'user'
        if (row.role_id) {
          const { error: delErr } = await supabase
            .from('user_roles').delete().eq('id', row.role_id);
          if (delErr) throw delErr;
        }
        await supabase.from('user_roles').insert({ user_id: row.user_id, role: 'user' as any });
        toast({ title: 'Rol resetat la Angajat', description: row.full_name });
      }
      await load();
    } catch (e: any) {
      toast({ title: 'Eroare', description: e.message || 'Nu s-a putut actualiza rolul.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const filtered = rows.filter(r => {
    if (showOnlyPensionari && !r.is_pensionar) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return r.full_name.toLowerCase().includes(s)
      || (r.email || '').toLowerCase().includes(s)
      || (r.department || '').toLowerCase().includes(s);
  });

  const totalPensionari = rows.filter(r => r.is_pensionar).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Pensionari colaboratori
            </CardTitle>
            <CardDescription>
              Marchează utilizatorii ieșiți la pensie care rămân activi ca și colaboratori.
              Aceștia păstrează acces limitat: social, chat, anunțuri, profil propriu și cerere proprie de concediu.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm">
            {totalPensionari} pensionar{totalPensionari === 1 ? '' : 'i'} activ{totalPensionari === 1 ? '' : 'i'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Caută după nume, email, departament..." className="pl-8"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant={showOnlyPensionari ? 'default' : 'outline'} size="sm"
            onClick={() => setShowOnlyPensionari(v => !v)}>
            {showOnlyPensionari ? 'Arată toți' : 'Doar pensionari'}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departament</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.email || '—'}</TableCell>
                    <TableCell className="text-sm">{r.department || '—'}</TableCell>
                    <TableCell>
                      {r.is_pensionar ? (
                        <Badge className="bg-stone-500 text-white">Pensionar colaborator</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Angajat</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.is_pensionar ? (
                        <Button size="sm" variant="outline" disabled={busy === r.user_id}
                          onClick={() => setPensionar(r, false)}>
                          <UserMinus className="w-3.5 h-3.5 mr-1" /> Retrage
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busy === r.user_id}
                          onClick={() => setPensionar(r, true)}>
                          <UserCheck className="w-3.5 h-3.5 mr-1" /> Marchează pensionar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Niciun utilizator găsit.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PensionariManager;
