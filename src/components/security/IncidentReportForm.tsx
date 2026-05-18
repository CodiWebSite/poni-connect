import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Upload, Clock3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'txt', 'eml'];
const MAX_SIZE = 10 * 1024 * 1024;

const Schema = z.object({
  incident_type: z.enum(['email_phishing','link_suspect','cont_compromis','dispozitiv_pierdut','fisier_suspect','altul']),
  description: z.string().trim().min(20, 'Descrie în cel puțin 20 de caractere ce s-a întâmplat.').max(4000),
  severity: z.enum(['low','medium','high','critical']),
});

export default function IncidentReportForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [incidentType, setIncidentType] = useState<string>('email_phishing');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<string>('medium');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const validateFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) return `Extensie nepermisă (.${ext}). Acceptate: ${ALLOWED_EXT.join(', ')}.`;
    if (f.size > MAX_SIZE) return 'Fișier prea mare (max 10 MB).';
    return null;
  };

  const submit = async () => {
    if (!user) return;
    const parsed = Schema.safeParse({ incident_type: incidentType, description, severity });
    if (!parsed.success) {
      toast({ title: 'Date invalide', description: parsed.error.issues[0].message, variant: 'destructive' });
      return;
    }
    if (file) {
      const err = validateFile(file);
      if (err) { toast({ title: 'Fișier respins', description: err, variant: 'destructive' }); return; }
    }
    setBusy(true);
    try {
      let attachment_path: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const path = `incidents/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('security-incidents')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        attachment_path = path;
      }
      const { error } = await supabase.from('security_incidents').insert({
        reporter_user_id: user.id,
        incident_type: parsed.data.incident_type,
        description: parsed.data.description,
        severity: parsed.data.severity,
        attachment_path,
      });
      if (error) throw error;
      toast({ title: 'Incident raportat', description: 'Echipa de securitate a fost notificată automat.' });
      setDescription(''); setFile(null); setSeverity('medium'); setIncidentType('email_phishing');
      onSubmitted?.();
    } catch (e: any) {
      toast({ title: 'Eroare', description: e?.message ?? 'Raportarea a eșuat.', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <ShieldAlert className="w-4 h-4" />
        <AlertTitle>Confidențialitate</AlertTitle>
        <AlertDescription>
          Raportul tău este vizibil doar pentru Super Admin și HR (dacă marcat relevant). Atașamentele sunt stocate într-un bucket privat.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock3 className="w-5 h-5" /> Primele 30 de minute</CardTitle>
          <CardDescription>Dacă suspectezi phishing sau cont compromis:</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1.5">
          <p>1. <strong>Nu da click</strong> pe linkuri suspecte; nu introduce parola.</p>
          <p>2. Schimbă imediat parola contului de la <code>/securitatea-mea</code>.</p>
          <p>3. Deconectează toate sesiunile active.</p>
          <p>4. Raportează aici cu cât mai multe detalii (expeditor, ora, URL).</p>
          <p>5. Așteaptă confirmarea Super Admin / SRUS înainte de orice acțiune ulterioară.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formular incident</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tip incident</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_phishing">Email de tip phishing</SelectItem>
                  <SelectItem value="link_suspect">Link / URL suspect</SelectItem>
                  <SelectItem value="cont_compromis">Cont posibil compromis</SelectItem>
                  <SelectItem value="dispozitiv_pierdut">Dispozitiv pierdut / furat</SelectItem>
                  <SelectItem value="fisier_suspect">Fișier / atașament suspect</SelectItem>
                  <SelectItem value="altul">Altul</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severitate estimată</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Scăzută</SelectItem>
                  <SelectItem value="medium">Medie</SelectItem>
                  <SelectItem value="high">Ridicată</SelectItem>
                  <SelectItem value="critical">Critică</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descriere (min. 20 caractere)</Label>
            <Textarea rows={5} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Am primit pe 18.05 ora 10:32 un email de la 'secretariat@1cmpp.ro' care cerea resetarea parolei printr-un link..." />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><Upload className="w-4 h-4" /> Atașament (opțional, max 10 MB)</Label>
            <Input type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,.eml"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">Extensii acceptate: PDF, PNG, JPG, TXT, EML.</p>
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Raportează incidentul
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
