import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, Loader2, Gift, Scale } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BonusLeave {
  id: string;
  year: number;
  bonus_days: number;
  reason: string;
  legal_basis: string | null;
  created_at: string;
}

interface Carryover {
  id: string;
  from_year: number;
  to_year: number;
  initial_days: number;
  used_days: number;
  remaining_days: number;
  notes: string | null;
}

interface LeaveBonusManagerProps {
  employeePersonalDataId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export const LeaveBonusManager = ({
  employeePersonalDataId,
  employeeName,
  open,
  onOpenChange,
  onSaved,
}: LeaveBonusManagerProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [bonuses, setBonuses] = useState<BonusLeave[]>([]);
  const [carryovers, setCarryovers] = useState<Carryover[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    year: new Date().getFullYear(),
    bonus_days: 0,
    reason: '',
    legal_basis: '',
  });

  useEffect(() => {
    if (open && employeePersonalDataId) {
      fetchData();
    }
  }, [open, employeePersonalDataId]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: bonusData }, { data: carryData }] = await Promise.all([
      supabase
        .from('leave_bonus')
        .select('*')
        .eq('employee_personal_data_id', employeePersonalDataId)
        .order('year', { ascending: false }),
      supabase
        .from('leave_carryover')
        .select('*')
        .eq('employee_personal_data_id', employeePersonalDataId)
        .order('from_year', { ascending: false }),
    ]);
    setBonuses((bonusData as BonusLeave[]) || []);
    setCarryovers((carryData as Carryover[]) || []);
    setLoading(false);
  };

  const addBonus = async () => {
    if (!form.reason || form.bonus_days <= 0) {
      toast({ title: 'Eroare', description: 'Completați motivul și numărul de zile.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('leave_bonus').insert({
      employee_personal_data_id: employeePersonalDataId,
      year: form.year,
      bonus_days: form.bonus_days,
      reason: form.reason,
      legal_basis: form.legal_basis || null,
      created_by: user?.id,
    });

    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'leave_bonus_add',
          _entity_type: 'leave_bonus',
          _entity_id: employeePersonalDataId,
          _details: { employee_name: employeeName, days: form.bonus_days, reason: form.reason, legal_basis: form.legal_basis }
        });
      }
      toast({ title: 'Adăugat', description: `+${form.bonus_days} zile suplimentare pentru ${employeeName}.` });
      setForm({ year: new Date().getFullYear(), bonus_days: 0, reason: '', legal_basis: '' });
      fetchData();
      onSaved?.();
    }
    setSaving(false);
  };

  const deleteBonus = async (bonus: BonusLeave) => {
    if (!confirm(`Sigur doriți să ștergeți ${bonus.bonus_days} zile bonus (${bonus.reason})?`)) return;
    const { error } = await supabase.from('leave_bonus').delete().eq('id', bonus.id);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Șters', description: 'Bonusul a fost eliminat.' });
      fetchData();
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Sold Suplimentar Concediu
          </DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Carryover section */}
            {carryovers.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Concedii Reportate</h4>
                {carryovers.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Report {c.from_year} → {c.to_year}</p>
                      <p className="text-xs text-muted-foreground">
                        Inițial: {c.initial_days} zile • Utilizate: {c.used_days} • Rămase: {c.remaining_days}
                      </p>
                    </div>
                    <Badge variant="outline">{c.remaining_days} zile</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Existing bonuses */}
            {bonuses.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Bonusuri Active</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>An</TableHead>
                      <TableHead>Zile</TableHead>
                      <TableHead>Motiv</TableHead>
                      <TableHead>Baza Legală</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bonuses.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm">{b.year}</TableCell>
                        <TableCell className="text-sm font-medium">+{b.bonus_days}</TableCell>
                        <TableCell className="text-sm">{b.reason}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{b.legal_basis || '-'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteBonus(b)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Add new bonus */}
            <div className="space-y-4 p-4 border border-dashed border-border rounded-lg">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Adaugă Sold Suplimentar
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>An</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm(f => ({ ...f, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Număr Zile Suplimentare *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.bonus_days || ''}
                    onChange={(e) => setForm(f => ({ ...f, bonus_days: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motiv *</Label>
                <Input
                  placeholder="ex: Handicap grad II, vechime etc."
                  value={form.reason}
                  onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5" />
                  Baza Legală
                </Label>
                <Textarea
                  placeholder="ex: Legea nr. 448/2006 art. 24, HG nr. 250/1992 art. 7 etc."
                  value={form.legal_basis}
                  onChange={(e) => setForm(f => ({ ...f, legal_basis: e.target.value }))}
                  rows={2}
                />
              </div>
              <Button onClick={addBonus} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Adaugă
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Închide</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
