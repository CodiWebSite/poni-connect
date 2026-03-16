import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, Plus, Trash2, ClipboardList } from 'lucide-react';

interface WorkHistoryRow {
  post: string;
  period: string;
  occupation: string;
  noxe: string;
}

interface DossierData {
  professional_training: string;
  professional_route: string;
  work_history: WorkHistoryRow[];
  current_activities: string;
  professional_diseases: boolean;
  professional_diseases_details: string;
  work_accidents: boolean;
  work_accidents_details: string;
  family_doctor: string;
  heredo_collateral: string;
  personal_physiological: string;
  personal_pathological: string;
  smoking: string;
  alcohol: string;
}

const EMPTY_FORM: DossierData = {
  professional_training: '',
  professional_route: '',
  work_history: [],
  current_activities: '',
  professional_diseases: false,
  professional_diseases_details: '',
  work_accidents: false,
  work_accidents_details: '',
  family_doctor: '',
  heredo_collateral: '',
  personal_physiological: '',
  personal_pathological: '',
  smoking: '',
  alcohol: '',
};

interface DossierDataFormProps {
  epdId: string;
  employeeName: string;
}

export default function DossierDataForm({ epdId, employeeName }: DossierDataFormProps) {
  const [form, setForm] = useState<DossierData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('medical_dossier_data' as any)
        .select('*')
        .eq('epd_id', epdId)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setExistingId(d.id);
        setForm({
          professional_training: d.professional_training || '',
          professional_route: d.professional_route || '',
          work_history: Array.isArray(d.work_history) ? d.work_history : [],
          current_activities: d.current_activities || '',
          professional_diseases: d.professional_diseases ?? false,
          professional_diseases_details: d.professional_diseases_details || '',
          work_accidents: d.work_accidents ?? false,
          work_accidents_details: d.work_accidents_details || '',
          family_doctor: d.family_doctor || '',
          heredo_collateral: d.heredo_collateral || '',
          personal_physiological: d.personal_physiological || '',
          personal_pathological: d.personal_pathological || '',
          smoking: d.smoking || '',
          alcohol: d.alcohol || '',
        });
      }
      setLoaded(true);
    };
    load();
  }, [epdId]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      epd_id: epdId,
      professional_training: form.professional_training || null,
      professional_route: form.professional_route || null,
      work_history: form.work_history,
      current_activities: form.current_activities || null,
      professional_diseases: form.professional_diseases,
      professional_diseases_details: form.professional_diseases_details || null,
      work_accidents: form.work_accidents,
      work_accidents_details: form.work_accidents_details || null,
      family_doctor: form.family_doctor || null,
      heredo_collateral: form.heredo_collateral || null,
      personal_physiological: form.personal_physiological || null,
      personal_pathological: form.personal_pathological || null,
      smoking: form.smoking || null,
      alcohol: form.alcohol || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existingId) {
      ({ error } = await supabase
        .from('medical_dossier_data' as any)
        .update(payload)
        .eq('id', existingId));
    } else {
      const { data, error: e } = await supabase
        .from('medical_dossier_data' as any)
        .insert(payload)
        .select('id')
        .single();
      error = e;
      if (data) setExistingId((data as any).id);
    }

    if (error) {
      toast.error('Eroare la salvare: ' + error.message);
    } else {
      toast.success('Datele dosarului au fost salvate');
    }
    setSaving(false);
  };

  const addWorkRow = () => {
    setForm(prev => ({
      ...prev,
      work_history: [...prev.work_history, { post: '', period: '', occupation: '', noxe: '' }],
    }));
  };

  const updateWorkRow = (idx: number, field: keyof WorkHistoryRow, value: string) => {
    setForm(prev => {
      const rows = [...prev.work_history];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, work_history: rows };
    });
  };

  const removeWorkRow = (idx: number) => {
    setForm(prev => ({
      ...prev,
      work_history: prev.work_history.filter((_, i) => i !== idx),
    }));
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="w-5 h-5" />
          Date Dosar Medical — {employeeName}
        </CardTitle>
        <CardDescription>
          Completează datele suplimentare care vor fi incluse automat în PDF-ul dosarului medical
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Professional training */}
        <div className="space-y-2">
          <Label>Formarea profesională</Label>
          <Textarea
            value={form.professional_training}
            onChange={e => setForm(p => ({ ...p, professional_training: e.target.value }))}
            placeholder="Ex: Inginer chimist, Universitatea ..."
            rows={2}
          />
        </div>

        {/* Professional route */}
        <div className="space-y-2">
          <Label>Ruta profesională</Label>
          <Textarea
            value={form.professional_route}
            onChange={e => setForm(p => ({ ...p, professional_route: e.target.value }))}
            placeholder="Descriere succintă a traseului profesional"
            rows={2}
          />
        </div>

        <Separator />

        {/* Work history table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Locuri de muncă anterioare</Label>
            <Button type="button" variant="outline" size="sm" onClick={addWorkRow}>
              <Plus className="w-4 h-4 mr-1" /> Adaugă rând
            </Button>
          </div>
          {form.work_history.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_0.7fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
                <span>Post / Loc de muncă</span>
                <span>Perioada</span>
                <span>Ocupația</span>
                <span>Noxe profesionale</span>
                <span></span>
              </div>
              {form.work_history.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_0.7fr_1fr_1fr_auto] gap-2">
                  <Input value={row.post} onChange={e => updateWorkRow(i, 'post', e.target.value)} placeholder="Post" />
                  <Input value={row.period} onChange={e => updateWorkRow(i, 'period', e.target.value)} placeholder="2010-2015" />
                  <Input value={row.occupation} onChange={e => updateWorkRow(i, 'occupation', e.target.value)} placeholder="Ocupația" />
                  <Input value={row.noxe} onChange={e => updateWorkRow(i, 'noxe', e.target.value)} placeholder="Noxe" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeWorkRow(i)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Niciun loc de muncă anterior adăugat</p>
          )}
        </div>

        {/* Current activities */}
        <div className="space-y-2">
          <Label>Activități la actualul loc de muncă / Noxe</Label>
          <Textarea
            value={form.current_activities}
            onChange={e => setForm(p => ({ ...p, current_activities: e.target.value }))}
            placeholder="Descriere activități și noxe profesionale"
            rows={2}
          />
        </div>

        <Separator />

        {/* Professional diseases */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.professional_diseases}
              onCheckedChange={v => setForm(p => ({ ...p, professional_diseases: v }))}
            />
            <Label>Boli profesionale</Label>
          </div>
          {form.professional_diseases && (
            <Textarea
              value={form.professional_diseases_details}
              onChange={e => setForm(p => ({ ...p, professional_diseases_details: e.target.value }))}
              placeholder="Detalii boli profesionale..."
              rows={2}
            />
          )}
        </div>

        {/* Work accidents */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.work_accidents}
              onCheckedChange={v => setForm(p => ({ ...p, work_accidents: v }))}
            />
            <Label>Accidente de muncă</Label>
          </div>
          {form.work_accidents && (
            <Textarea
              value={form.work_accidents_details}
              onChange={e => setForm(p => ({ ...p, work_accidents_details: e.target.value }))}
              placeholder="Detalii accidente de muncă..."
              rows={2}
            />
          )}
        </div>

        <Separator />

        {/* Family doctor */}
        <div className="space-y-2">
          <Label>Medic de familie</Label>
          <Input
            value={form.family_doctor}
            onChange={e => setForm(p => ({ ...p, family_doctor: e.target.value }))}
            placeholder="Dr. ..."
          />
        </div>

        {/* Antecedents */}
        <div className="space-y-2">
          <Label>Antecedente heredocolaterale</Label>
          <Textarea
            value={form.heredo_collateral}
            onChange={e => setForm(p => ({ ...p, heredo_collateral: e.target.value }))}
            placeholder="Boli în familie (diabet, HTA, cancer, etc.)"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Antecedente personale fiziologice</Label>
          <Textarea
            value={form.personal_physiological}
            onChange={e => setForm(p => ({ ...p, personal_physiological: e.target.value }))}
            placeholder="Sarcini, nașteri, menopauză, etc."
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Antecedente personale patologice</Label>
          <Textarea
            value={form.personal_pathological}
            onChange={e => setForm(p => ({ ...p, personal_pathological: e.target.value }))}
            placeholder="Boli cronice, intervenții chirurgicale, internări, etc."
            rows={2}
          />
        </div>

        <Separator />

        {/* Habits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Fumat</Label>
            <Input
              value={form.smoking}
              onChange={e => setForm(p => ({ ...p, smoking: e.target.value }))}
              placeholder="Ex: Nefumător / 10 țig/zi / Ex-fumător"
            />
          </div>
          <div className="space-y-2">
            <Label>Consum alcool</Label>
            <Input
              value={form.alcohol}
              onChange={e => setForm(p => ({ ...p, alcohol: e.target.value }))}
              placeholder="Ex: Ocazional / Abstinent / Moderat"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Se salvează...' : 'Salvează datele dosarului'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
