import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Headset, Loader2, CheckCircle2, Mail, Phone, User as UserIcon, MessageSquare, Send, Clock, XCircle, History } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const SUBJECTS = [
  'Probleme autentificare / cont',
  'Probleme acces platformă',
  'Eroare aplicație',
  'Solicitare funcționalitate',
  'Probleme echipament IT',
  'Altele',
];

interface HelpdeskTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

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
  const [tickets, setTickets] = useState<HelpdeskTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const fetchTickets = async () => {
    if (!user) return;
    setLoadingTickets(true);
    const { data } = await supabase
      .from('helpdesk_tickets')
      .select('id, subject, message, status, admin_notes, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    setTickets((data as any as HelpdeskTicket[]) || []);
    setLoadingTickets(false);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setSent(false);
      setMessage('');
      setSubject('');
      if (user?.email) setEmail(user.email);
      fetchTickets();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Toate câmpurile marcate cu * sunt obligatorii.');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('helpdesk_tickets').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject || 'General',
      message: message.trim(),
    });

    if (error) {
      console.error('Helpdesk ticket insert error:', error);
      toast.error('Eroare la trimiterea mesajului. Încercați din nou.');
    } else {
      setSent(true);
      fetchTickets();
    }
    setSending(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 text-xs"><Clock className="w-3 h-3 mr-1" />Deschis</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-info/10 text-info border-info/20 text-xs"><Loader2 className="w-3 h-3 mr-1" />În lucru</Badge>;
      case 'resolved':
        return <Badge variant="default" className="bg-success/10 text-success border-success/20 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Rezolvat</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headset className="w-5 h-5 text-primary" />
            Contact IT — HelpDesk
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="text-xs"><Send className="w-3.5 h-3.5 mr-1.5" />Mesaj nou</TabsTrigger>
            <TabsTrigger value="history" className="text-xs"><History className="w-3.5 h-3.5 mr-1.5" />Istoricul meu</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-3">
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
                <Button variant="outline" onClick={() => setSent(false)} className="w-full">
                  Trimite alt mesaj
                </Button>
              </div>
            ) : (
              <>
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

                <form onSubmit={handleSubmit} className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="it-name" className="text-xs">Nume *</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input id="it-name" placeholder="Nume complet" className="pl-8 h-9 text-sm" value={name} onChange={(e) => setName(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="it-email" className="text-xs">Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input id="it-email" type="email" placeholder="email@icmpp.ro" className="pl-8 h-9 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                    <Textarea id="it-message" placeholder="Descrie problema în detaliu..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="text-sm" required />
                  </div>

                  <Button type="submit" className="w-full" variant="hero" disabled={sending}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    {sending ? 'Se trimite...' : 'Trimite mesajul'}
                  </Button>
                </form>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            {loadingTickets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nu ai trimis încă niciun tichet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{ticket.subject}</p>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{ticket.message}</p>
                    {ticket.admin_notes && (
                      <div className="rounded bg-muted/60 px-2.5 py-1.5 text-xs">
                        <span className="font-medium text-foreground/80">Răspuns IT:</span>{' '}
                        <span className="text-muted-foreground">{ticket.admin_notes}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {format(new Date(ticket.created_at), 'd MMM yyyy, HH:mm', { locale: ro })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ITContactDialog;
