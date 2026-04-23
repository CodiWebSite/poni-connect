import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Europe/Bucharest';
const fmtRo = (s: string) => format(toZonedTime(parseISO(s), TZ), 'dd.MM.yyyy HH:mm', { locale: ro });

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin', sef: 'Șef Departament', sef_srus: 'Șef SRUS',
  hr: 'HR (SRUS)', director_institut: 'Director', director_adjunct: 'Director Adjunct',
  secretar_stiintific: 'Secretar Științific', user: 'Angajat',
};

interface AuditRow {
  id: string;
  action: string;
  created_at: string;
  details: any;
  user_id: string;
  entity_id: string | null;
}

interface ProfileMap { [k: string]: string }

export default function RoleAuditPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, created_at, details, user_id, entity_id')
        .in('action', ['role_assigned', 'role_removed', 'role_change'])
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) { setLoading(false); return; }

      const ids = new Set<string>();
      (data || []).forEach(r => {
        if (r.user_id) ids.add(r.user_id);
        if (r.entity_id) ids.add(r.entity_id);
        const d = r.details as any;
        if (d?.actor_user_id) ids.add(d.actor_user_id);
        if (d?.target_user_id) ids.add(d.target_user_id);
      });

      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(ids));

      const map: ProfileMap = {};
      (profs || []).forEach(p => { map[p.user_id] = p.full_name || '—'; });

      setProfiles(map);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const target = profiles[r.entity_id || ''] || profiles[(r.details as any)?.target_user_id || ''] || '';
    const actor = profiles[r.user_id] || '';
    const role = (r.details as any)?.role || (r.details as any)?.new_role || '';
    return target.toLowerCase().includes(q) || actor.toLowerCase().includes(q) || role.toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Audit Roluri
        </CardTitle>
        <CardDescription>
          Cine și când a acordat / modificat / retras roluri (inclusiv asignări automate de Șef Departament).
        </CardDescription>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Caută după nume sau rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Niciun eveniment de rol înregistrat.</p>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Acțiune</TableHead>
                  <TableHead>Utilizator țintă</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Făcut de</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const d = r.details || {};
                  const targetId = r.entity_id || d.target_user_id;
                  const targetName = targetId ? (profiles[targetId] || '—') : '—';
                  const actorId = d.actor_user_id || r.user_id;
                  const isSystem = d.source === 'system_trigger' || (!d.actor_user_id && r.action === 'role_assigned');
                  const actorName = isSystem ? 'Sistem (auto)' : (profiles[actorId] || '—');
                  const roleKey = d.role || d.new_role || '—';
                  const variant = r.action === 'role_removed' ? 'destructive' : 'default';
                  const label = r.action === 'role_assigned' ? 'Acordat'
                    : r.action === 'role_removed' ? 'Retras' : 'Modificat';
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtRo(r.created_at)}</TableCell>
                      <TableCell><Badge variant={variant as any}>{label}</Badge></TableCell>
                      <TableCell className="font-medium">{targetName}</TableCell>
                      <TableCell><Badge variant="secondary">{roleLabels[roleKey] || roleKey}</Badge></TableCell>
                      <TableCell className={isSystem ? 'text-muted-foreground italic' : ''}>{actorName}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
