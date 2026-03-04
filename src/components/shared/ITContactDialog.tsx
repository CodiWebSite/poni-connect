import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Headset, Loader2, CheckCircle2, Mail, Phone, User as UserIcon, MessageSquare, Send } from 'lucide-react';

const SUBJECTS = [
  'Probleme autentificare / cont',
  'Probleme acces platformă',
  'Eroare aplicație',
  'Solicitare funcționalitate',
  'Probleme echipament IT',
  'Altele',
];

interface ITContactDialogProps {
  trigger?: React.ReactNode;
}

const ITContactDialog = ({ trigger }: ITContactDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setSent(false);
      setMessage('');
      setSubject('');
      if (user?.email) setEmail(user.email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Toate câmpurile marcate cu * sunt obligatorii.');
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

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Headset className="w-4 h-4" />
            Contact IT
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headset className="w-5 h-5 text-primary" />
            Contact IT — HelpDesk
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Mesaj trimis!</h3>
              <p className="text-sm text-muted-foreground">
                Echipa IT a fost notificată și va răspunde cât mai curând.
              </p>
            </div>
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full">
              Închide
            </Button>
          </div>
        ) : (
          <>
            {/* IT Contact Info */}
            <div className="rounded-lg bg-muted/50 border border-border/60 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/80 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                Contact direct:
              </p>
              <p>Condrea Codrin — Tehnician IT, interior <span className="font-medium">330</span></p>
              <p>Buzdugan Cătălin — Departamentul IT, interior <span className="font-medium">160</span></p>
              <p className="pt-0.5">
                <a href="mailto:condrea.codrin@icmpp.ro" className="text-primary hover:underline">condrea.codrin@icmpp.ro</a>
                {' · '}
                <a href="mailto:admin@icmpp.ro" className="text-primary hover:underline">admin@icmpp.ro</a>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="it-name" className="text-xs">Nume *</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="it-name"
                      placeholder="Nume complet"
                      className="pl-8 h-9 text-sm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="it-email" className="text-xs">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="it-email"
                      type="email"
                      placeholder="email@icmpp.ro"
                      className="pl-8 h-9 text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="it-subject" className="text-xs">Subiect</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selectează categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="it-message" className="text-xs">Mesaj *</Label>
                <Textarea
                  id="it-message"
                  placeholder="Descrie problema în detaliu..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="text-sm"
                  required
                />
              </div>

              <Button type="submit" className="w-full" variant="hero" disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {sending ? 'Se trimite...' : 'Trimite mesajul'}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ITContactDialog;
