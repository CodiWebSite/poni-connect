import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Plus, XCircle, Loader2, Calendar, Users } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';

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
  delegate_name?: string;
}

interface ColleagueOption {
  user_id: string;
  full_name: string;
  position: string | null;
}

export function LeaveApprovalDelegate() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [colleagues, setColleagues] = useState<ColleagueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [selectedColleague, setSelectedColleague] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('concediu');

  useEffect(() => {
    if (user) {
      fetchDelegations();
      fetchColleagues();
    }
  }, [user]);

  const fetchDelegations = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('leave_approval_delegates' as any)
      .select('*')
      .eq('delegator_user_id', user.id)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching delegations:', error);
      setLoading(false);
      return;
    }

    // Enrich with delegate names
    const delegateIds = [...new Set((data || []).map((d: any) => d.delegate_user_id))];
    let nameMap: Record<string, string> = {};
    if (delegateIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', delegateIds);
      (profiles || []).forEach(p => { nameMap[p.user_id] = p.full_name; });
    }

    setDelegations((data || []).map((d: any) => ({
      ...d,
      delegate_name: nameMap[d.delegate_user_id] || 'Necunoscut',
    })));
    setLoading(false);
  };

  const fetchColleagues = async () => {
    if (!user) return;

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('department')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!myProfile?.department) return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, position')
      .eq('department', myProfile.department)
      .neq('user_id', user.id);

    setColleagues((profiles || []).map(p => ({
      user_id: p.user_id,
      full_name: p.full_name,
      position: p.position,
    })));
  };

  const handleSubmit = async () => {
    if (!user || !selectedColleague || !startDate || !endDate) {
      toast({ title: 'Eroare', description: 'Completați toate câmpurile obligatorii.', variant: 'destructive' });
      return;
    }

    if (parseISO(endDate) < parseISO(startDate)) {
      toast({ title: 'Eroare', description: 'Data de sfârșit trebuie să fie după data de început.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('department')
      .eq('user_id', user.id)
      .maybeSingle();

    const { error } = await supabase
      .from('leave_approval_delegates' as any)
      .insert({
        delegator_user_id: user.id,
        delegate_user_id: selectedColleague,
        department: myProfile?.department || null,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        is_active: true,
      });

    if (error) {
      console.error('Error creating delegation:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut crea înlocuirea.', variant: 'destructive' });
    } else {
      // Notify the delegate
      const colleagueName = colleagues.find(c => c.user_id === selectedColleague)?.full_name || '';
      const { data: myName } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();

      await supabase.from('notifications').insert({
        user_id: selectedColleague,
        title: 'Desemnat ca înlocuitor pentru aprobări',
        message: `${myName?.full_name || 'Un coleg'} te-a desemnat ca înlocuitor pentru aprobarea cererilor de concediu în perioada ${format(parseISO(startDate), 'dd.MM.yyyy')} – ${format(parseISO(endDate), 'dd.MM.yyyy')}. Motiv: ${reason === 'concediu' ? 'Concediu' : reason === 'delegatie' ? 'Delegație' : reason}.`,
        type: 'info',
      });

      toast({ title: 'Înlocuitor desemnat', description: `${colleagueName} va aproba cererile în perioada selectată.` });
      setShowForm(false);
      setSelectedColleague('');
      setStartDate('');
      setEndDate('');
      setReason('concediu');
      fetchDelegations();
    }

    setSubmitting(false);
  };

  const handleDeactivate = async (id: string) => {
    const { error } = await supabase
      .from('leave_approval_delegates' as any)
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut dezactiva înlocuirea.', variant: 'destructive' });
    } else {
      toast({ title: 'Dezactivat', description: 'Înlocuirea a fost dezactivată.' });
      fetchDelegations();
    }
  };

  const getDelegationStatus = (d: Delegation) => {
    const now = new Date();
    const start = parseISO(d.start_date);
    const end = parseISO(d.end_date);

    if (!d.is_active) return { label: 'Dezactivat', variant: 'secondary' as const };
    if (isBefore(end, now) && !isToday(end)) return { label: 'Expirat', variant: 'secondary' as const };
    if ((isAfter(now, start) || isToday(start)) && (isBefore(now, end) || isToday(end))) return { label: 'Activ', variant: 'default' as const };
    return { label: 'Programat', variant: 'outline' as const };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Înlocuitor Temporar
          </h3>
          <p className="text-sm text-muted-foreground">
            Desemnați un coleg care să aprobe cererile de concediu în absența dumneavoastră.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Adaugă Înlocuitor
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Înlocuitor Nou</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Coleg înlocuitor *</Label>
              <Select value={selectedColleague} onValueChange={setSelectedColleague}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectați colegul" />
                </SelectTrigger>
                <SelectContent>
                  {colleagues.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {c.full_name} {c.position ? `— ${c.position}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data început *</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data sfârșit *</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motiv</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concediu">Concediu</SelectItem>
                  <SelectItem value="delegatie">Delegație</SelectItem>
                  <SelectItem value="altele">Altele</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Anulează</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                Salvează
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {delegations.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nu aveți înlocuitori configurați. Adăugați unul înainte de a pleca în concediu sau delegație.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {delegations.map(d => {
            const status = getDelegationStatus(d);
            return (
              <Card key={d.id}>
                <CardContent className="pt-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.delegate_name}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(parseISO(d.start_date), 'dd MMM yyyy', { locale: ro })} – {format(parseISO(d.end_date), 'dd MMM yyyy', { locale: ro })}
                      </p>
                      {d.reason && (
                        <p className="text-sm text-muted-foreground">
                          Motiv: {d.reason === 'concediu' ? 'Concediu' : d.reason === 'delegatie' ? 'Delegație' : d.reason}
                        </p>
                      )}
                    </div>
                    {d.is_active && status.label !== 'Expirat' && (
                      <Button variant="outline" size="sm" onClick={() => handleDeactivate(d.id)} className="gap-1">
                        <XCircle className="w-4 h-4" />
                        Dezactivează
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
