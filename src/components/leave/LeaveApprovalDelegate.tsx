import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, ArrowRightLeft, Building2, Calendar, Loader2, Plus, UserCheck, Users, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { canTransferDelegation, formatReplacementConflict, type ReplacementConflict } from '@/utils/leaveReplacementRules';

interface Delegation {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  department: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  transferred_from_delegation_id?: string | null;
  delegate_name?: string;
  delegator_name?: string;
}

interface ColleagueOption {
  user_id: string;
  full_name: string;
  position: string | null;
}

const CROSS_DEPARTMENT_PAIRS: Record<string, string> = {
  'ebcea4c3-bed6-4960-bb27-4f43303094b3': '50c33275-d49f-48a4-a9f9-ad6f36b70d4b',
  '50c33275-d49f-48a4-a9f9-ad6f36b70d4b': 'ebcea4c3-bed6-4960-bb27-4f43303094b3',
};

const todayString = () => new Date().toISOString().split('T')[0];
const formatPeriod = (start: string, end: string) =>
  `${format(parseISO(start), 'dd MMM yyyy', { locale: ro })} – ${format(parseISO(end), 'dd MMM yyyy', { locale: ro })}`;

export function LeaveApprovalDelegate() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [incomingDelegations, setIncomingDelegations] = useState<Delegation[]>([]);
  const [colleagues, setColleagues] = useState<ColleagueOption[]>([]);
  const [transferColleagues, setTransferColleagues] = useState<ColleagueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(Boolean(searchParams.get('from')));
  const [selectedColleague, setSelectedColleague] = useState('');
  const [startDate, setStartDate] = useState(searchParams.get('from') || '');
  const [endDate, setEndDate] = useState(searchParams.get('to') || '');
  const [reason, setReason] = useState('concediu');
  const [transferSource, setTransferSource] = useState<Delegation | null>(null);
  const [selectedTransferColleague, setSelectedTransferColleague] = useState('');
  const [conflicts, setConflicts] = useState<ReplacementConflict[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  useEffect(() => {
    if (user) {
      void fetchDelegations();
      void fetchColleagues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const enrichNames = async (rows: Delegation[]) => {
    const userIds = [...new Set(rows.flatMap((row) => [row.delegator_user_id, row.delegate_user_id]))];
    const nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      (profiles || []).forEach((profile) => { nameMap[profile.user_id] = profile.full_name; });
    }
    return rows.map((row) => ({
      ...row,
      delegate_name: nameMap[row.delegate_user_id] || 'Necunoscut',
      delegator_name: nameMap[row.delegator_user_id] || 'Necunoscut',
    }));
  };

  const fetchDelegations = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: own }, { data: incoming }] = await Promise.all([
      supabase.from('leave_approval_delegates').select('*').eq('delegator_user_id', user.id).order('start_date', { ascending: false }),
      supabase.from('leave_approval_delegates').select('*').eq('delegate_user_id', user.id).eq('is_active', true).gte('end_date', todayString()).order('start_date', { ascending: false }),
    ]);
    setDelegations(await enrichNames((own || []) as Delegation[]));
    setIncomingDelegations(await enrichNames((incoming || []) as Delegation[]));
    setLoading(false);
  };

  const fetchColleagues = async () => {
    if (!user) return;
    const { data: myProfile } = await supabase.from('profiles').select('department').eq('user_id', user.id).maybeSingle();
    if (!myProfile?.department) return;
    const { data: deptProfiles } = await supabase.from('profiles')
      .select('user_id, full_name, position').eq('department', myProfile.department).neq('user_id', user.id);
    const allColleagues = (deptProfiles || []) as ColleagueOption[];
    const extraColleagueId = CROSS_DEPARTMENT_PAIRS[user.id];
    if (extraColleagueId && !allColleagues.some((colleague) => colleague.user_id === extraColleagueId)) {
      const { data: extraProfile } = await supabase.from('profiles')
        .select('user_id, full_name, position').eq('user_id', extraColleagueId).maybeSingle();
      if (extraProfile) allColleagues.push(extraProfile);
    }
    setColleagues(allColleagues);
  };

  useEffect(() => {
    if (!transferSource || !user) {
      setTransferColleagues([]);
      return;
    }
    setSelectedTransferColleague('');
    void (async () => {
      if (!transferSource.department) return;
      const { data } = await supabase.from('profiles').select('user_id, full_name, position')
        .eq('department', transferSource.department)
        .neq('user_id', user.id)
        .neq('user_id', transferSource.delegator_user_id);
      setTransferColleagues((data || []) as ColleagueOption[]);
    })();
  }, [transferSource, user]);

  const delegateToCheck = transferSource ? selectedTransferColleague : selectedColleague;
  const checkStart = transferSource?.start_date || startDate;
  const checkEnd = transferSource?.end_date || endDate;

  useEffect(() => {
    setConflicts([]);
    if (!delegateToCheck || !checkStart || !checkEnd) return;
    let current = true;
    setCheckingConflicts(true);
    const timer = window.setTimeout(() => {
      void supabase.functions.invoke('manage-leave-replacements', {
        body: {
          action: 'check-delegate',
          delegate_user_id: delegateToCheck,
          start_date: checkStart,
          end_date: checkEnd,
          source_delegation_id: transferSource?.id,
        },
      }).then(({ data, error }) => {
        if (!current) return;
        if (error) {
          console.warn('Verificarea disponibilității înlocuitorului nu a reușit', error);
          setConflicts([]);
        } else {
          setConflicts((data?.conflicts || []) as ReplacementConflict[]);
        }
      }).finally(() => { if (current) setCheckingConflicts(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [delegateToCheck, checkStart, checkEnd, transferSource?.id]);

  const invokeAction = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('manage-leave-replacements', { body });
    if (error) {
      let message = 'Acțiunea nu a putut fi finalizată.';
      try {
        const responseBody = await (error as { context?: Response }).context?.json();
        if (responseBody?.error) message = responseBody.error;
      } catch { /* păstrăm mesajul general */ }
      throw new Error(message);
    }
    if (data?.error) {
      if (data.conflicts) setConflicts(data.conflicts);
      throw new Error(data.error);
    }
    return data;
  };

  const handleSubmit = async () => {
    if (!user || !selectedColleague || !startDate || !endDate) {
      toast({ title: 'Completați toate câmpurile obligatorii.', variant: 'destructive' });
      return;
    }
    if (endDate < startDate) {
      toast({ title: 'Data de sfârșit trebuie să fie după data de început.', variant: 'destructive' });
      return;
    }
    if (conflicts.length) return;
    setSubmitting(true);
    try {
      const result = await invokeAction({ action: 'create', delegate_user_id: selectedColleague, start_date: startDate, end_date: endDate, reason });
      const colleagueName = colleagues.find((colleague) => colleague.user_id === selectedColleague)?.full_name || 'Colegul';
      toast({
        title: 'Înlocuitor desemnat',
        description: `${colleagueName} a primit notificare și e-mail.${result?.emails?.failed ? ' Unele e-mailuri nu au plecat; acțiunea a fost totuși salvată.' : ''}`,
      });
      setShowForm(false);
      setSelectedColleague('');
      setStartDate('');
      setEndDate('');
      setReason('concediu');
      await fetchDelegations();
    } catch (error) {
      toast({ title: 'Înlocuirea nu a fost salvată', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferSource || !selectedTransferColleague || conflicts.length) return;
    setSubmitting(true);
    try {
      const result = await invokeAction({ action: 'transfer', source_delegation_id: transferSource.id, new_delegate_user_id: selectedTransferColleague });
      toast({
        title: 'Ștafeta a fost transferată',
        description: `Noul înlocuitor a preluat ${transferSource.department || 'compartimentul original'}.${result?.emails?.failed ? ' Unele e-mailuri nu au plecat.' : ''}`,
      });
      setTransferSource(null);
      setSelectedTransferColleague('');
      await fetchDelegations();
    } catch (error) {
      toast({ title: 'Transferul nu a fost salvat', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    setSubmitting(true);
    try {
      const result = await invokeAction({ action: 'deactivate', delegation_id: id });
      toast({ title: 'Înlocuire dezactivată', description: result?.emails?.failed ? 'Modificarea este salvată, dar unele e-mailuri nu au plecat.' : 'Cei implicați au fost anunțați.' });
      await fetchDelegations();
    } catch (error) {
      toast({ title: 'Dezactivarea nu a reușit', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getDelegationStatus = (delegation: Delegation) => {
    const today = todayString();
    if (!delegation.is_active) return { label: 'Dezactivat', variant: 'secondary' as const };
    if (delegation.end_date < today) return { label: 'Expirat', variant: 'secondary' as const };
    if (delegation.start_date > today) return { label: 'Programat', variant: 'outline' as const };
    return { label: 'Activ', variant: 'default' as const };
  };

  const conflictWarning = (conflicts.length > 0 || checkingConflicts) && (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <p className="flex items-center gap-2 font-medium">
        {checkingConflicts ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
        {checkingConflicts ? 'Verificăm disponibilitatea colegului…' : 'Colegul nu poate fi ales pentru această perioadă'}
      </p>
      {conflicts.map((conflict, index) => <p key={index} className="ml-6 mt-1 text-xs">• {formatReplacementConflict(conflict)}</p>)}
    </div>
  );

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5" /> Înlocuitor temporar</h3>
          <p className="text-sm text-muted-foreground">Desemnați cine aprobă cererile de concediu în absența dumneavoastră.</p>
        </div>
        {!showForm && !transferSource && <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="h-4 w-4" /> Adaugă înlocuitor</Button>}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Înlocuitor nou</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Coleg înlocuitor *</Label>
              <Select value={selectedColleague} onValueChange={setSelectedColleague}>
                <SelectTrigger><SelectValue placeholder="Selectați colegul" /></SelectTrigger>
                <SelectContent>{colleagues.map((colleague) => <SelectItem key={colleague.user_id} value={colleague.user_id}>{colleague.full_name}{colleague.position ? ` — ${colleague.position}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Data început *</Label><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
              <div className="space-y-2"><Label>Data sfârșit *</Label><Input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Motiv</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="concediu">Concediu</SelectItem><SelectItem value="delegatie">Delegație</SelectItem><SelectItem value="altele">Altele</SelectItem></SelectContent>
              </Select>
            </div>
            {conflictWarning}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setConflicts([]); }}>Anulează</Button>
              <Button onClick={handleSubmit} disabled={submitting || checkingConflicts || conflicts.length > 0} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Salvează și anunță
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {transferSource && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArrowRightLeft className="h-4 w-4" /> Transferă ștafeta primită</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p><strong>Șef original:</strong> {transferSource.delegator_name}</p>
              <p><strong>Compartiment:</strong> {transferSource.department || 'Nespecificat'}</p>
              <p><strong>Perioada:</strong> {formatPeriod(transferSource.start_date, transferSource.end_date)}</p>
            </div>
            <div className="space-y-2">
              <Label>Noul înlocuitor din compartimentul original *</Label>
              <Select value={selectedTransferColleague} onValueChange={setSelectedTransferColleague}>
                <SelectTrigger><SelectValue placeholder="Selectați colegul care preia ștafeta" /></SelectTrigger>
                <SelectContent>{transferColleagues.map((colleague) => <SelectItem key={colleague.user_id} value={colleague.user_id}>{colleague.full_name}{colleague.position ? ` — ${colleague.position}` : ''}</SelectItem>)}</SelectContent>
              </Select>
              {transferSource.department && transferColleagues.length === 0 && <p className="text-xs text-muted-foreground">Nu există alt coleg eligibil în acest compartiment.</p>}
            </div>
            {conflictWarning}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setTransferSource(null); setConflicts([]); }}>Anulează</Button>
              <Button onClick={handleTransfer} disabled={submitting || checkingConflicts || !selectedTransferColleague || conflicts.length > 0} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Transferă și anunță
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {incomingDelegations.length > 0 && (
        <section className="space-y-3">
          <h4 className="font-medium">Înlocuiri primite de la alți șefi</h4>
          {incomingDelegations.map((delegation) => (
            <Card key={delegation.id} className="border-primary/20">
              <CardContent className="flex flex-col justify-between gap-3 pt-4 md:flex-row md:items-center">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">De la {delegation.delegator_name}</span><Badge variant={getDelegationStatus(delegation).variant}>{getDelegationStatus(delegation).label}</Badge></div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{delegation.department || 'Compartiment nespecificat'}</p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{formatPeriod(delegation.start_date, delegation.end_date)}</p>
                  <p className="text-xs text-muted-foreground">Puteți aproba cererile acestui compartiment, pe lângă cele proprii.</p>
                </div>
                {canTransferDelegation(delegation, user?.id, todayString()) && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowForm(false); setTransferSource(delegation); }}>
                    <ArrowRightLeft className="h-4 w-4" /> Transferă ștafeta
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h4 className="font-medium">Înlocuitorii desemnați de dumneavoastră</h4>
        {delegations.length === 0 && !showForm ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nu aveți înlocuitori configurați. Adăugați unul înainte de a pleca în concediu sau delegație.</CardContent></Card>
        ) : delegations.map((delegation) => {
          const status = getDelegationStatus(delegation);
          return (
            <Card key={delegation.id}>
              <CardContent className="flex flex-col justify-between gap-3 pt-4 md:flex-row md:items-center">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{delegation.delegate_name}</span><Badge variant={status.variant}>{status.label}</Badge>{delegation.transferred_from_delegation_id && <Badge variant="outline">Primit prin ștafetă</Badge>}</div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{delegation.department || 'Compartiment nespecificat'}</p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{formatPeriod(delegation.start_date, delegation.end_date)}</p>
                </div>
                {delegation.is_active && status.label !== 'Expirat' && <Button variant="outline" size="sm" disabled={submitting} onClick={() => handleDeactivate(delegation.id)} className="gap-1"><XCircle className="h-4 w-4" /> Dezactivează</Button>}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
