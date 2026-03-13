import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bell, Loader2, Send, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AccountReminderPanel = () => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [result, setResult] = useState<{ sent_count?: number; total_inactive?: number; failed?: string[] } | null>(null);

  const sendReminders = async () => {
    setSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-reminder-email', {
        body: {},
      });

      if (error) throw error;

      setResult(data);
      if (data?.sent_count > 0) {
        toast({
          title: 'Remindere trimise!',
          description: `${data.sent_count} email-uri trimise din ${data.total_inactive} angajați inactivi.`,
        });
      } else if (data?.sent_count === 0) {
        toast({
          title: 'Toți angajații au cont activ!',
          description: 'Nu există angajați fără cont pe platformă.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare necunoscută';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    }
    setSending(false);
  };

  const sendTestEmail = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-reminder-email', {
        body: { testEmail: 'condrea.codrin@icmpp.ro' },
      });

      if (error) throw error;

      toast({
        title: 'Email test trimis!',
        description: 'Un model de reminder a fost trimis pe condrea.codrin@icmpp.ro',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare necunoscută';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    }
    setSendingTest(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Reminder Conturi Inactive
        </CardTitle>
        <CardDescription>
          Trimite un email de reminder tuturor angajaților din baza de date HR care nu și-au creat încă cont pe platformă.
          Email-ul conține beneficiile platformei și instrucțiuni pas cu pas pentru înregistrare.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={sendTestEmail}
            variant="outline"
            disabled={sendingTest || sending}
          >
            {sendingTest ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            {sendingTest ? 'Se trimite...' : 'Trimite model test (la tine)'}
          </Button>

          <Button
            onClick={sendReminders}
            disabled={sending || sendingTest}
            className="bg-primary"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {sending ? 'Se trimit remindere...' : 'Trimite reminder la toți inactivii'}
          </Button>
        </div>

        {result && (
          <div className="p-4 bg-secondary/30 rounded-lg border border-border space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-medium">Rezultat trimitere</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{result.total_inactive} angajați fără cont</Badge>
              <Badge className="bg-green-100 text-green-800 border-green-300">{result.sent_count} email-uri trimise</Badge>
              {(result.failed?.length || 0) > 0 && (
                <Badge variant="destructive">{result.failed?.length} eșuate</Badge>
              )}
            </div>
            {(result.failed?.length || 0) > 0 && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Email-uri eșuate:
                </p>
                <p className="text-xs text-muted-foreground mt-1">{result.failed?.join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AccountReminderPanel;
