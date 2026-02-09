import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';

const fieldLabels: Record<string, string> = {
  full_name: 'Nume complet',
  department: 'Departament',
  position: 'Funcție',
  email: 'Email',
  phone: 'Telefon',
  cnp: 'CNP',
  address: 'Adresă',
  ci: 'Carte de Identitate',
  hire_date: 'Data angajării',
  contract_type: 'Tip contract',
  leave_days: 'Zile concediu',
  other: 'Altele',
};

interface CorrectionRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentData?: {
    full_name?: string;
    department?: string;
    position?: string;
    phone?: string;
  };
}

export const CorrectionRequestForm = ({ open, onOpenChange, currentData }: CorrectionRequestFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    field_name: '',
    current_value: '',
    requested_value: '',
    reason: '',
  });

  const handleFieldChange = (field: string) => {
    let currentValue = '';
    if (currentData) {
      switch (field) {
        case 'full_name': currentValue = currentData.full_name || ''; break;
        case 'department': currentValue = currentData.department || ''; break;
        case 'position': currentValue = currentData.position || ''; break;
        case 'phone': currentValue = currentData.phone || ''; break;
        default: currentValue = '';
      }
    }
    setForm({ ...form, field_name: field, current_value: currentValue });
  };

  const handleSubmit = async () => {
    if (!user || !form.field_name || !form.requested_value.trim()) {
      toast({ title: 'Eroare', description: 'Completați câmpul și valoarea corectă.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('data_correction_requests')
      .insert({
        user_id: user.id,
        field_name: form.field_name,
        current_value: form.current_value || null,
        requested_value: form.requested_value.trim(),
        reason: form.reason.trim() || null,
      });

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut trimite cererea.', variant: 'destructive' });
    } else {
      toast({ title: 'Cerere trimisă', description: 'Departamentul HR va analiza cererea dvs. de corecție.' });
      setForm({ field_name: '', current_value: '', requested_value: '', reason: '' });
      onOpenChange(false);
    }

    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitare Corecție Date</DialogTitle>
          <DialogDescription>
            Trimiteți o cerere către departamentul HR pentru corectarea datelor personale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ce doriți să corectați? *</Label>
            <Select value={form.field_name} onValueChange={handleFieldChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selectați câmpul..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(fieldLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.current_value && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Valoare curentă</Label>
              <Input value={form.current_value} disabled className="bg-muted" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Valoarea corectă *</Label>
            <Input 
              placeholder="Introduceți valoarea corectă..."
              value={form.requested_value}
              onChange={(e) => setForm({ ...form, requested_value: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Detalii suplimentare</Label>
            <Textarea 
              placeholder="Explicați de ce este necesară corecția (opțional)..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anulează</Button>
          <Button onClick={handleSubmit} disabled={submitting || !form.field_name || !form.requested_value.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Trimite Cererea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
