import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface PersonalData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  cnp: string;
  department: string | null;
  position: string | null;
  contract_type: string | null;
  total_leave_days: number | null;
  used_leave_days: number | null;
  employment_date: string;
  ci_series: string | null;
  ci_number: string | null;
  ci_issued_by: string | null;
  ci_issued_date: string | null;
  address_street: string | null;
  address_number: string | null;
  address_block: string | null;
  address_floor: string | null;
  address_apartment: string | null;
  address_city: string | null;
  address_county: string | null;
}

interface PersonalDataEditorProps {
  employeeRecordId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export const PersonalDataEditor = ({ 
  employeeRecordId, 
  employeeName, 
  open, 
  onOpenChange,
  onSaved 
}: PersonalDataEditorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    cnp: '',
    department: '',
    position: '',
    contract_type: 'nedeterminat',
    total_leave_days: 21,
    used_leave_days: 0,
    employment_date: '',
    ci_series: '',
    ci_number: '',
    ci_issued_by: '',
    ci_issued_date: '',
    address_street: '',
    address_number: '',
    address_block: '',
    address_floor: '',
    address_apartment: '',
    address_city: '',
    address_county: ''
  });

  useEffect(() => {
    if (open && employeeRecordId) {
      fetchPersonalData();
    }
  }, [open, employeeRecordId]);

  const fetchPersonalData = async () => {
    if (!employeeRecordId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('employee_personal_data')
      .select('*')
      .eq('employee_record_id', employeeRecordId)
      .maybeSingle();

    if (data) {
      setPersonalData(data);
      setForm({
        email: data.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        cnp: data.cnp || '',
        department: data.department || '',
        position: data.position || '',
        contract_type: data.contract_type || 'nedeterminat',
        total_leave_days: data.total_leave_days ?? 21,
        used_leave_days: data.used_leave_days ?? 0,
        employment_date: data.employment_date || '',
        ci_series: data.ci_series || '',
        ci_number: data.ci_number || '',
        ci_issued_by: data.ci_issued_by || '',
        ci_issued_date: data.ci_issued_date || '',
        address_street: data.address_street || '',
        address_number: data.address_number || '',
        address_block: data.address_block || '',
        address_floor: data.address_floor || '',
        address_apartment: data.address_apartment || '',
        address_city: data.address_city || '',
        address_county: data.address_county || ''
      });
    } else if (error) {
      console.error('Error fetching personal data:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!personalData?.id) {
      toast({ title: 'Eroare', description: 'Nu există date personale pentru acest angajat.', variant: 'destructive' });
      return;
    }

    if (!form.email || !form.first_name || !form.last_name || !form.cnp) {
      toast({ title: 'Eroare', description: 'Email, prenume, nume și CNP sunt obligatorii.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    
    const { error } = await supabase
      .from('employee_personal_data')
      .update({
        email: form.email.toLowerCase().trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        cnp: form.cnp.trim(),
        department: form.department || null,
        position: form.position || null,
        contract_type: form.contract_type || 'nedeterminat',
        total_leave_days: form.total_leave_days,
        used_leave_days: form.used_leave_days,
        employment_date: form.employment_date,
        ci_series: form.ci_series || null,
        ci_number: form.ci_number || null,
        ci_issued_by: form.ci_issued_by || null,
        ci_issued_date: form.ci_issued_date || null,
        address_street: form.address_street || null,
        address_number: form.address_number || null,
        address_block: form.address_block || null,
        address_floor: form.address_floor || null,
        address_apartment: form.address_apartment || null,
        address_city: form.address_city || null,
        address_county: form.address_county || null,
      })
      .eq('id', personalData.id);

    if (error) {
      toast({ title: 'Eroare', description: `Nu s-au putut salva datele: ${error.message}`, variant: 'destructive' });
    } else {
      toast({ title: 'Salvat', description: 'Datele personale au fost actualizate.' });
      onSaved?.();
      onOpenChange(false);
    }
    
    setSaving(false);
  };

  const updateForm = (field: keyof typeof form, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Date Personale Complete</DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !personalData ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nu există date personale pentru acest angajat.</p>
            <p className="text-sm">Importați datele din XLS pentru a le putea edita.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Core Data */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Date de bază</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prenume *</Label>
                  <Input 
                    value={form.first_name} 
                    onChange={(e) => updateForm('first_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nume *</Label>
                  <Input 
                    value={form.last_name} 
                    onChange={(e) => updateForm('last_name', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={form.email} 
                    onChange={(e) => updateForm('email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNP *</Label>
                  <Input 
                    value={form.cnp} 
                    onChange={(e) => updateForm('cnp', e.target.value)}
                    maxLength={13}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Employment Data */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Date angajare</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Departament</Label>
                  <Input 
                    placeholder="ex: Laborator Polimeri"
                    value={form.department} 
                    onChange={(e) => updateForm('department', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Funcție</Label>
                  <Input 
                    placeholder="ex: CS III"
                    value={form.position} 
                    onChange={(e) => updateForm('position', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Angajării</Label>
                  <Input 
                    type="date"
                    value={form.employment_date} 
                    onChange={(e) => updateForm('employment_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tip Contract</Label>
                  <Select
                    value={form.contract_type}
                    onValueChange={(v) => updateForm('contract_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nedeterminat">Perioadă Nedeterminată</SelectItem>
                      <SelectItem value="determinat">Perioadă Determinată</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Zile Concediu</Label>
                  <Input 
                    type="number"
                    value={form.total_leave_days} 
                    onChange={(e) => updateForm('total_leave_days', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zile Utilizate</Label>
                  <Input 
                    type="number"
                    value={form.used_leave_days} 
                    onChange={(e) => updateForm('used_leave_days', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="text-muted-foreground">Zile disponibile: </span>
                  <span className="font-bold text-primary">
                    {form.total_leave_days - form.used_leave_days}
                  </span>
                </p>
              </div>
            </div>

            <Separator />

            {/* ID Card Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Carte de Identitate</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Serie CI</Label>
                  <Input 
                    value={form.ci_series} 
                    onChange={(e) => updateForm('ci_series', e.target.value.toUpperCase())}
                    maxLength={2}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Număr CI</Label>
                  <Input 
                    value={form.ci_number} 
                    onChange={(e) => updateForm('ci_number', e.target.value)}
                    maxLength={6}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Eliberat de</Label>
                  <Input 
                    value={form.ci_issued_by} 
                    onChange={(e) => updateForm('ci_issued_by', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Eliberării</Label>
                  <Input 
                    type="date"
                    value={form.ci_issued_date} 
                    onChange={(e) => updateForm('ci_issued_date', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Address Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Adresă</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Stradă</Label>
                  <Input 
                    value={form.address_street} 
                    onChange={(e) => updateForm('address_street', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Număr</Label>
                  <Input 
                    value={form.address_number} 
                    onChange={(e) => updateForm('address_number', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bloc</Label>
                  <Input 
                    value={form.address_block} 
                    onChange={(e) => updateForm('address_block', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Etaj</Label>
                  <Input 
                    value={form.address_floor} 
                    onChange={(e) => updateForm('address_floor', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apartament</Label>
                  <Input 
                    value={form.address_apartment} 
                    onChange={(e) => updateForm('address_apartment', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Oraș/Comună</Label>
                  <Input 
                    value={form.address_city} 
                    onChange={(e) => updateForm('address_city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Județ</Label>
                  <Input 
                    value={form.address_county} 
                    onChange={(e) => updateForm('address_county', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button onClick={handleSave} disabled={saving || !personalData}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
