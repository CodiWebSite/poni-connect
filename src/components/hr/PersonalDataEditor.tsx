import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface PersonalData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  cnp: string;
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
  employment_date: string;
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
    first_name: '',
    last_name: '',
    cnp: '',
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
    address_county: '',
    employment_date: ''
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
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        cnp: data.cnp || '',
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
        address_county: data.address_county || '',
        employment_date: data.employment_date || ''
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

    setSaving(true);
    
    const { error } = await supabase
      .from('employee_personal_data')
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        cnp: form.cnp,
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
        employment_date: form.employment_date
      })
      .eq('id', personalData.id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-au putut salva datele.', variant: 'destructive' });
    } else {
      toast({ title: 'Salvat', description: 'Datele personale au fost actualizate.' });
      onSaved?.();
      onOpenChange(false);
    }
    
    setSaving(false);
  };

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Date Personale</DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !personalData ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nu există date personale pentru acest angajat.</p>
            <p className="text-sm">Importați datele din CSV pentru a le putea edita.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Identity Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Identitate</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prenume</Label>
                  <Input 
                    value={form.first_name} 
                    onChange={(e) => updateForm('first_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nume</Label>
                  <Input 
                    value={form.last_name} 
                    onChange={(e) => updateForm('last_name', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CNP</Label>
                <Input 
                  value={form.cnp} 
                  onChange={(e) => updateForm('cnp', e.target.value)}
                  maxLength={13}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Angajării</Label>
                <Input 
                  type="date"
                  value={form.employment_date} 
                  onChange={(e) => updateForm('employment_date', e.target.value)}
                />
              </div>
            </div>

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
              <div className="grid grid-cols-4 gap-4">
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
                <div></div>
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
