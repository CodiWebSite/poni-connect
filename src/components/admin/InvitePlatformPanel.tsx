import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const InvitePlatformPanel = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentEmails, setSentEmails] = useState<string[]>([]);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast({ title: 'Eroare', description: 'Introduceți o adresă de email.', variant: 'destructive' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: 'Eroare', description: 'Adresa de email nu este validă.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: trimmed },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Invitație trimisă!', description: `Un email de invitație a fost trimis la ${trimmed}.` });
        setSentEmails(prev => [trimmed, ...prev]);
        setEmail('');
      } else {
        toast({ title: 'Eroare', description: data?.error || 'Nu s-a putut trimite invitația.', variant: 'destructive' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare necunoscută';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Invitații pe platformă
        </CardTitle>
        <CardDescription>
          Trimite o invitație prin email pentru a crea un cont pe platformă. Utilizatorul va primi un link de activare.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="adresa@icmpp.ro"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !sending && handleInvite()}
            className="flex-1"
          />
          <Button onClick={handleInvite} disabled={sending || !email.trim()}>
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Se trimite...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Trimite invitație</>
            )}
          </Button>
        </div>

        {sentEmails.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-muted-foreground">Invitații trimise în această sesiune:</p>
            <div className="flex flex-wrap gap-2">
              {sentEmails.map((e, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  {e}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvitePlatformPanel;
