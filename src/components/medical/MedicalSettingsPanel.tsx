import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Save } from 'lucide-react';
import type { MedicalCabinetConfig } from '@/utils/generateFisaAptitudine';
import { DEFAULT_MEDICAL_CONFIG } from '@/utils/generateFisaAptitudine';

interface MedicalSettingsPanelProps {
  onConfigLoaded?: (config: MedicalCabinetConfig) => void;
}

const SETTING_KEYS: { key: keyof MedicalCabinetConfig; dbKey: string; label: string }[] = [
  { key: 'medicalUnitName', dbKey: 'medical_unit_name', label: 'Unitate medicală (nume firmă)' },
  { key: 'cabinetAddress', dbKey: 'medical_cabinet_address', label: 'Adresă cabinet' },
  { key: 'cabinetPhone', dbKey: 'medical_cabinet_phone', label: 'Telefon/Fax cabinet' },
  { key: 'doctorName', dbKey: 'medical_doctor_name', label: 'Nume medic medicina muncii' },
  { key: 'companyName', dbKey: 'medical_company_name', label: 'Denumire societate (angajator)' },
  { key: 'companyAddress', dbKey: 'medical_company_address', label: 'Adresă societate' },
  { key: 'companyPhone', dbKey: 'medical_company_phone', label: 'Telefon societate' },
];

export function useMedicalConfig() {
  const [config, setConfig] = useState<MedicalCabinetConfig>(DEFAULT_MEDICAL_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', SETTING_KEYS.map(s => s.dbKey));
      
      if (data && data.length > 0) {
        const map: Record<string, string> = {};
        data.forEach(row => { map[row.key as string] = typeof row.value === 'string' ? row.value : String(row.value); });
        
        setConfig({
          medicalUnitName: map.medical_unit_name || DEFAULT_MEDICAL_CONFIG.medicalUnitName,
          cabinetAddress: map.medical_cabinet_address || DEFAULT_MEDICAL_CONFIG.cabinetAddress,
          cabinetPhone: map.medical_cabinet_phone || DEFAULT_MEDICAL_CONFIG.cabinetPhone,
          doctorName: map.medical_doctor_name || DEFAULT_MEDICAL_CONFIG.doctorName,
          companyName: map.medical_company_name || DEFAULT_MEDICAL_CONFIG.companyName,
          companyAddress: map.medical_company_address || DEFAULT_MEDICAL_CONFIG.companyAddress,
          companyPhone: map.medical_company_phone || DEFAULT_MEDICAL_CONFIG.companyPhone,
        });
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return { config, loading };
}

export default function MedicalSettingsPanel({ onConfigLoaded }: MedicalSettingsPanelProps) {
  const [form, setForm] = useState<MedicalCabinetConfig>(DEFAULT_MEDICAL_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', SETTING_KEYS.map(s => s.dbKey));

      if (data && data.length > 0) {
        const map: Record<string, string> = {};
        data.forEach(row => { map[row.key as string] = typeof row.value === 'string' ? row.value : String(row.value); });

        const cfg: MedicalCabinetConfig = {
          medicalUnitName: map.medical_unit_name || DEFAULT_MEDICAL_CONFIG.medicalUnitName,
          cabinetAddress: map.medical_cabinet_address || DEFAULT_MEDICAL_CONFIG.cabinetAddress,
          cabinetPhone: map.medical_cabinet_phone || DEFAULT_MEDICAL_CONFIG.cabinetPhone,
          doctorName: map.medical_doctor_name || DEFAULT_MEDICAL_CONFIG.doctorName,
          companyName: map.medical_company_name || DEFAULT_MEDICAL_CONFIG.companyName,
          companyAddress: map.medical_company_address || DEFAULT_MEDICAL_CONFIG.companyAddress,
          companyPhone: map.medical_company_phone || DEFAULT_MEDICAL_CONFIG.companyPhone,
        };
        setForm(cfg);
        onConfigLoaded?.(cfg);
      }
      setLoaded(true);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const updates = SETTING_KEYS.map(s => ({
      key: s.dbKey,
      value: form[s.key] as any,
      updated_at: new Date().toISOString(),
    }));

    for (const u of updates) {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: u.key, value: u.value, updated_at: u.updated_at }, { onConflict: 'key' });
      if (error) {
        toast.error(`Eroare la salvare ${u.key}: ${error.message}`);
        setSaving(false);
        return;
      }
    }

    toast.success('Setările cabinetului medical au fost salvate');
    onConfigLoaded?.(form);
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Setări Cabinet Medical
        </CardTitle>
        <CardDescription>
          Configurează datele cabinetului medical și ale societății pentru fișele de aptitudine
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SETTING_KEYS.map(s => (
            <div key={s.key} className="space-y-1.5">
              <Label className="text-sm">{s.label}</Label>
              <Input
                value={form[s.key]}
                onChange={e => setForm(prev => ({ ...prev, [s.key]: e.target.value }))}
                placeholder={DEFAULT_MEDICAL_CONFIG[s.key] || s.label}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Se salvează...' : 'Salvează setările'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
