import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Headset, Loader2, CheckCircle2, Mail, User, MessageSquare } from 'lucide-react';

interface HelpdeskContactFormProps {
  onBack: () => void;
}

const SUBJECTS = [
  'Probleme autentificare / cont',
  'Probleme acces platformă',
  'Eroare aplicație',
  'Solicitare funcționalitate',
  'Probleme echipament IT',
  'Altele',
];

const HelpdeskContactForm = ({ onBack }: HelpdeskContactFormProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Numele, emailul și mesajul sunt obligatorii.');
      return;
    }

    if (!email.endsWith('@icmpp.ro')) {
      toast.error('Doar adresele @icmpp.ro sunt acceptate.');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('helpdesk_tickets' as any).insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject || 'General',
      message: message.trim(),
    } as any);

    if (error) {
      toast.error('Eroare la trimiterea mesajului. Încercați din nou.');
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
          <h3 className="text-lg font-semibold">Mesaj trimis!</h3>
          <p className="text-sm text-muted-foreground">
            Echipa IT a fost notificată și va răspunde în cel mai scurt timp posibil.
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
          <Headset className="w-5 h-5 text-primary" />
          Contact IT — HelpDesk
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Descrie problema întâmpinată și echipa IT te va contacta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="hd-name">Nume complet *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="hd-name"
              placeholder="Ex: Ion Popescu"
              className="pl-10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hd-email">Email instituțional *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="hd-email"
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
          <Label htmlFor="hd-subject">Subiect</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Selectează categoria" />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hd-message">Mesaj *</Label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Textarea
              id="hd-message"
              placeholder="Descrie problema în detaliu..."
              className="pl-10"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" variant="hero" disabled={sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Headset className="w-4 h-4 mr-2" />}
          {sending ? 'Se trimite...' : 'Trimite mesajul'}
        </Button>
      </form>
    </div>
  );
};

export default HelpdeskContactForm;
