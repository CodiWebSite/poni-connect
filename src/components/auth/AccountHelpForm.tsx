import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, HelpCircle, Loader2, CheckCircle2, Mail, User } from 'lucide-react';

interface AccountHelpFormProps {
  onBack: () => void;
}

const AccountHelpForm = ({ onBack }: AccountHelpFormProps) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim()) {
      toast.error('Numele și emailul sunt obligatorii.');
      return;
    }

    if (!email.endsWith('@icmpp.ro')) {
      toast.error('Doar adresele @icmpp.ro sunt acceptate.');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('account_requests' as any).insert({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim() || null,
    } as any);

    if (error) {
      toast.error('Eroare la trimiterea cererii. Încercați din nou.');
    } else {
      setSent(true);
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Cerere trimisă!</h3>
          <p className="text-sm text-muted-foreground">
            Administratorul IT a fost notificat și va crea contul tău manual.
            Vei primi credențialele de acces pe email în cel mai scurt timp.
          </p>
        </div>
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Înapoi la autentificare
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
        Înapoi la autentificare
      </button>

      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary" />
          Asistență creare cont
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Completează datele de mai jos și administratorul IT îți va crea contul manual.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="help-name">Nume complet *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="help-name"
              placeholder="Ex: Ion Popescu"
              className="pl-10"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="help-email">Email instituțional *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="help-email"
              type="email"
              placeholder="email@icmpp.ro"
              className="pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="help-message">Mesaj (opțional)</Label>
          <Textarea
            id="help-message"
            placeholder="Descrie problema întâmpinată (ex: nu primesc emailul de confirmare, eroare la înregistrare...)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
        </div>

        <Button type="submit" className="w-full" variant="hero" disabled={sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {sending ? 'Se trimite...' : 'Trimite cererea'}
        </Button>
      </form>
    </div>
  );
};

export default AccountHelpForm;
