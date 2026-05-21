import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, LifeBuoy, Loader2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  onBack: () => void;
  defaultEmail?: string;
}

const REASONS = [
  { value: 'lost_phone', label: 'Am pierdut/schimbat telefonul' },
  { value: 'app_reset', label: 'Aplicația de autentificare s-a resetat' },
  { value: 'codes_not_working', label: 'Codurile generate nu sunt acceptate' },
  { value: 'other', label: 'Alt motiv' },
];

/**
 * Public form (no auth required) used when the user cannot pass MFA and
 * has no recovery code. Creates a `helpdesk_tickets` row of type
 * `mfa_reset` with priority `security_high`. Super admins are notified.
 * Does NOT reset MFA — that remains a manual admin action.
 */
export default function MFAResetRequestForm({ onBack, defaultEmail = '' }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: defaultEmail,
    reason: 'lost_phone',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) {
      toast.error('Te rugăm să completezi numele și emailul.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('helpdesk-mfa-reset-request', {
        body: form,
      });
      if (error || !data?.success) {
        toast.error(data?.error || 'Nu am putut trimite cererea. Încearcă din nou.');
        setSubmitting(false);
        return;
      }
      setDone(data.ticket_id);
    } catch {
      toast.error('Eroare de rețea.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4 text-center py-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <LifeBuoy className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Cerere înregistrată</h3>
        <p className="text-sm text-muted-foreground">
          Un administrator a fost notificat și te va contacta cât mai curând posibil
          pentru a verifica identitatea ta înainte de resetarea 2FA.
        </p>
        <p className="text-xs text-muted-foreground">ID cerere: <span className="font-mono">{done.slice(0, 8)}</span></p>
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Înapoi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Înapoi
      </button>

      <div className="space-y-1">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-primary" />
          Solicită resetare 2FA
        </h3>
        <p className="text-sm text-muted-foreground">
          Un super-admin va verifica identitatea ta și va reseta manual autentificarea în doi pași.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="reset-name">Nume complet</Label>
          <Input
            id="reset-name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Ion Popescu"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email instituțional</Label>
          <Input
            id="reset-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@icmpp.ro"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Motivul</Label>
          <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-desc">Detalii (opțional)</Label>
          <Textarea
            id="reset-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 1000) })}
            placeholder="Context util pentru administrator..."
          />
        </div>
        <Button type="submit" className="w-full" variant="hero" disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Trimite cererea
        </Button>
      </form>
    </div>
  );
}
