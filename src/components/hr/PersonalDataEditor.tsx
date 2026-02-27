import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Save, Upload, Download, Trash2, Clock, FileImage } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

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
  ci_scan_url: string | null;
  ci_scan_uploaded_at: string | null;
  address_street: string | null;
  address_number: string | null;
  address_block: string | null;
  address_floor: string | null;
  address_apartment: string | null;
  address_city: string | null;
  address_county: string | null;
  updated_at: string;
}

interface PersonalDataEditorProps {
  employeeRecordId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  employeePersonalDataId?: string;
}

export const PersonalDataEditor = ({ 
  employeeRecordId, 
  employeeName, 
  open, 
  onOpenChange,
  onSaved,
  employeePersonalDataId
}: PersonalDataEditorProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [ciFile, setCiFile] = useState<File | null>(null);
  const [uploadingCi, setUploadingCi] = useState(false);
  const [carryover2025, setCarryover2025] = useState({ id: '', initial_days: 0, used_days: 0 });
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    cnp: '',
    department: '',
    position: '',
    grade: '',
    contract_type: 'nedeterminat',
    total_leave_days: 21,
    used_leave_days: 0,
    employment_date: '',
    ci_series: '',
    ci_number: '',
    ci_issued_by: '',
    ci_issued_date: '',
    ci_expiry_date: '',
    address_street: '',
    address_number: '',
    address_block: '',
    address_floor: '',
    address_apartment: '',
    address_city: '',
    address_county: ''
  });

  useEffect(() => {
    if (open && (employeeRecordId || employeePersonalDataId)) {
      fetchPersonalData();
    }
  }, [open, employeeRecordId, employeePersonalDataId]);

  const fetchPersonalData = async () => {
    setLoading(true);
    
    let query = supabase.from('employee_personal_data').select('*');
    
    if (employeeRecordId) {
      query = query.eq('employee_record_id', employeeRecordId);
    } else if (employeePersonalDataId) {
      query = query.eq('id', employeePersonalDataId);
    } else {
      setLoading(false);
      return;
    }
    
    const { data, error } = await query.maybeSingle();

    if (data) {
      setPersonalData(data as PersonalData);
      setForm({
        email: data.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        cnp: data.cnp || '',
        department: data.department || '',
        position: data.position || '',
        grade: (data as any).grade || '',
        contract_type: data.contract_type || 'nedeterminat',
        total_leave_days: data.total_leave_days ?? 21,
        used_leave_days: data.used_leave_days ?? 0,
        employment_date: data.employment_date || '',
        ci_series: data.ci_series || '',
        ci_number: data.ci_number || '',
        ci_issued_by: data.ci_issued_by || '',
        ci_issued_date: data.ci_issued_date || '',
        ci_expiry_date: (data as any).ci_expiry_date || '',
        address_street: data.address_street || '',
        address_number: data.address_number || '',
        address_block: data.address_block || '',
        address_floor: data.address_floor || '',
        address_apartment: data.address_apartment || '',
        address_city: data.address_city || '',
        address_county: data.address_county || ''
      });

      // Fetch 2025 carryover
      const currentYear = new Date().getFullYear();
      const { data: carryData } = await supabase
        .from('leave_carryover')
        .select('id, initial_days, used_days, remaining_days')
        .eq('employee_personal_data_id', data.id)
        .eq('from_year', currentYear - 1)
        .eq('to_year', currentYear)
        .maybeSingle();

      if (carryData) {
        setCarryover2025({ id: carryData.id, initial_days: carryData.initial_days, used_days: carryData.used_days });
      } else {
        setCarryover2025({ id: '', initial_days: 0, used_days: 0 });
      }
    } else if (error) {
      console.error('Error fetching personal data:', error);
    }
    setLoading(false);
  };

  const handleUploadCi = async () => {
    if (!ciFile || !personalData?.id) return;
    
    setUploadingCi(true);
    try {
      const fileExt = ciFile.name.split('.').pop();
      const fileName = `ci-scans/${personalData.id}/${Date.now()}.${fileExt}`;
      
      // Remove old CI scan if exists
      if (personalData.ci_scan_url) {
        await supabase.storage.from('employee-documents').remove([personalData.ci_scan_url]);
      }

      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(fileName, ciFile);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('employee_personal_data')
        .update({ 
          ci_scan_url: fileName,
          ci_scan_uploaded_at: new Date().toISOString()
        })
        .eq('id', personalData.id);

      if (updateError) throw updateError;

      // Also add to employee_documents so it appears in the employee's documents section
      // Find user_id via employee_records
      const { data: epdData } = await supabase
        .from('employee_personal_data')
        .select('employee_record_id')
        .eq('id', personalData.id)
        .maybeSingle();
      
      if (epdData?.employee_record_id) {
        const { data: recData } = await supabase
          .from('employee_records')
          .select('user_id')
          .eq('id', epdData.employee_record_id)
          .maybeSingle();
        
        if (recData?.user_id) {
          // Remove old CI document entries for this user
          await supabase
            .from('employee_documents')
            .delete()
            .eq('user_id', recData.user_id)
            .eq('document_type', 'carte_identitate');

          await supabase.from('employee_documents').insert({
            user_id: recData.user_id,
            document_type: 'carte_identitate',
            name: `Carte de Identitate - ${form.last_name} ${form.first_name}`,
            description: `CI ${form.ci_series}${form.ci_number} - scanare încărcată de HR`,
            file_url: fileName,
            uploaded_by: user?.id,
          });
        }
      }

      // Log audit event
      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'ci_scan_upload',
          _entity_type: 'employee_personal_data',
          _entity_id: personalData.id,
          _details: { employee_name: `${form.last_name} ${form.first_name}`, file_name: ciFile.name }
        });
      }

      toast({ title: 'Succes', description: 'Cartea de identitate a fost încărcată.' });
      setCiFile(null);
      fetchPersonalData();
    } catch (error) {
      console.error('CI upload error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut încărca CI.', variant: 'destructive' });
    }
    setUploadingCi(false);
  };

  const downloadCiScan = async () => {
    if (!personalData?.ci_scan_url) return;
    try {
      const { data, error } = await supabase.storage
        .from('employee-documents')
        .download(personalData.ci_scan_url);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CI_${form.last_name}_${form.first_name}.${personalData.ci_scan_url.split('.').pop()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut descărca fișierul.', variant: 'destructive' });
    }
  };

  const deleteCiScan = async () => {
    if (!personalData?.ci_scan_url || !confirm('Sigur doriți să ștergeți scanarea CI?')) return;
    try {
      await supabase.storage.from('employee-documents').remove([personalData.ci_scan_url]);
      await supabase
        .from('employee_personal_data')
        .update({ ci_scan_url: null, ci_scan_uploaded_at: null })
        .eq('id', personalData.id);
      toast({ title: 'Succes', description: 'Scanarea CI a fost ștearsă.' });
      fetchPersonalData();
    } catch (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge fișierul.', variant: 'destructive' });
    }
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
        grade: form.grade || null,
        contract_type: form.contract_type || 'nedeterminat',
        total_leave_days: form.total_leave_days,
        used_leave_days: form.used_leave_days,
        employment_date: form.employment_date,
        ci_series: form.ci_series || null,
        ci_number: form.ci_number || null,
        ci_issued_by: form.ci_issued_by || null,
        ci_issued_date: form.ci_issued_date || null,
        ci_expiry_date: form.ci_expiry_date || null,
        address_street: form.address_street || null,
        address_number: form.address_number || null,
        address_block: form.address_block || null,
        address_floor: form.address_floor || null,
        address_apartment: form.address_apartment || null,
        address_city: form.address_city || null,
        address_county: form.address_county || null,
        last_updated_by: user?.id || null,
      })
      .eq('id', personalData.id);

    if (error) {
      toast({ title: 'Eroare', description: `Nu s-au putut salva datele: ${error.message}`, variant: 'destructive' });
    } else {
      // Save/create 2025 carryover
      const currentYear = new Date().getFullYear();
      if (carryover2025.id) {
        await supabase
          .from('leave_carryover')
          .update({
            initial_days: carryover2025.initial_days,
            used_days: carryover2025.used_days,
            remaining_days: carryover2025.initial_days - carryover2025.used_days,
          })
          .eq('id', carryover2025.id);
      } else if (carryover2025.initial_days > 0) {
        const { data: newCarry } = await supabase
          .from('leave_carryover')
          .insert({
            employee_personal_data_id: personalData.id,
            from_year: currentYear - 1,
            to_year: currentYear,
            initial_days: carryover2025.initial_days,
            used_days: carryover2025.used_days,
            remaining_days: carryover2025.initial_days - carryover2025.used_days,
            created_by: user?.id,
          })
          .select('id')
          .single();
        if (newCarry) setCarryover2025(prev => ({ ...prev, id: newCarry.id }));
      }

      // Log audit event
      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'employee_edit',
          _entity_type: 'employee_personal_data',
          _entity_id: personalData.id,
          _details: { employee_name: `${form.last_name} ${form.first_name}` }
        });
      }
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
            {/* Last update info */}
            {personalData.updated_at && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                Ultima actualizare: {format(new Date(personalData.updated_at), 'dd.MM.yyyy HH:mm', { locale: ro })}
              </div>
            )}

            {/* Core Data */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Date de bază</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nume *</Label>
                  <Input 
                    value={form.last_name} 
                    onChange={(e) => updateForm('last_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prenume *</Label>
                  <Input 
                    value={form.first_name} 
                    onChange={(e) => updateForm('first_name', e.target.value)}
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
                    placeholder="ex: CS, IDT"
                    value={form.position} 
                    onChange={(e) => updateForm('position', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Grad / Treaptă</Label>
                  <Input 
                    placeholder="ex: I, II, III"
                    value={form.grade} 
                    onChange={(e) => updateForm('grade', e.target.value)}
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
              {/* Current year (2026) leave */}
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide pt-2">Sold Concediu {new Date().getFullYear()}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zile Cuvenite {new Date().getFullYear()}</Label>
                  <Input 
                    type="number"
                    value={form.total_leave_days} 
                    onChange={(e) => updateForm('total_leave_days', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zile Utilizate {new Date().getFullYear()}</Label>
                  <Input 
                    type="number"
                    value={form.used_leave_days} 
                    onChange={(e) => updateForm('used_leave_days', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="text-muted-foreground">Disponibile {new Date().getFullYear()}: </span>
                  <span className="font-bold text-primary">
                    {form.total_leave_days - form.used_leave_days}
                  </span>
                </p>
              </div>

              {/* Previous year (2025) carryover */}
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide pt-2">Sold Reportat {new Date().getFullYear() - 1}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zile Reportate din {new Date().getFullYear() - 1}</Label>
                  <Input 
                    type="number"
                    value={carryover2025.initial_days}
                    onChange={(e) => setCarryover2025(prev => ({ ...prev, initial_days: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zile Utilizate din report</Label>
                  <Input 
                    type="number"
                    value={carryover2025.used_days}
                    onChange={(e) => setCarryover2025(prev => ({ ...prev, used_days: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="text-muted-foreground">Disponibile din {new Date().getFullYear() - 1}: </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {carryover2025.initial_days - carryover2025.used_days}
                  </span>
                </p>
              </div>

              {/* Total summary */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">Sold Total Disponibil: </span>
                  <span className="font-bold text-primary text-base">
                    {(form.total_leave_days - form.used_leave_days) + (carryover2025.initial_days - carryover2025.used_days)} zile
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
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Număr CI</Label>
                  <Input 
                    value={form.ci_number} 
                    onChange={(e) => updateForm('ci_number', e.target.value)}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Expirare CI</Label>
                  <Input 
                    type="date"
                    value={form.ci_expiry_date} 
                    onChange={(e) => updateForm('ci_expiry_date', e.target.value)}
                  />
                </div>
              </div>

              {/* CI Scan Upload */}
              <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Scanare CI</span>
                </div>

                {personalData.ci_scan_url ? (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <FileImage className="w-3 h-3 mr-1" />
                        CI atașată
                      </Badge>
                      {personalData.ci_scan_uploaded_at && (
                        <span className="text-xs text-muted-foreground">
                          Încărcată: {format(new Date(personalData.ci_scan_uploaded_at), 'dd.MM.yyyy HH:mm', { locale: ro })}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={downloadCiScan}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={deleteCiScan}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nicio scanare CI atașată.</p>
                )}

                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setCiFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleUploadCi} 
                    disabled={!ciFile || uploadingCi}
                  >
                    {uploadingCi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Format: PDF, JPG, PNG</p>
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
