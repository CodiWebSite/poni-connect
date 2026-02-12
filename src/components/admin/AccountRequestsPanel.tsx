import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Inbox, CheckCircle2, Clock, Copy, Check, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface AccountRequest {
  id: string;
  full_name: string;
  email: string;
  message: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const AccountRequestsPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('account_requests' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data as unknown as AccountRequest[]);
    }
    setLoading(false);
  };

  const markResolved = async (id: string) => {
    setResolvingId(id);
    const { error } = await supabase
      .from('account_requests' as any)
      .update({
        status: 'resolved',
        resolved_by: user?.id,
        resolved_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    if (!error) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
      toast({ title: 'Cerere rezolvată' });
    }
    setResolvingId(null);
  };

  const generateCredentialMessage = (req: AccountRequest, password: string = 'Icmpp2026!') => {
    return `Bună ziua, ${req.full_name},

Contul dumneavoastră pe platforma Intranet ICMPP a fost creat cu succes.

📧 Email: ${req.email}
🔑 Parolă temporară: ${password}

🔗 Link acces: https://poni-connect-hub.lovable.app/auth

⚠️ IMPORTANT: Vă rugăm să vă schimbați parola imediat după prima autentificare:
   - Din pagina de login → "Ai uitat parola?" → introduceți emailul → veți primi un link de resetare
   - Sau din Setări → Schimbă parola (după ce vă logați)

Pentru orice problemă, contactați administratorul IT.

Cu stimă,
Echipa IT - ICMPP "Petru Poni" Iași`;
  };

  const copyCredentials = (req: AccountRequest) => {
    const msg = generateCredentialMessage(req);
    navigator.clipboard.writeText(msg);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copiat!', description: 'Mesajul cu credențialele a fost copiat în clipboard.' });
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const resolvedRequests = requests.filter(r => r.status === 'resolved');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
            Cereri de creare cont
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingRequests.length} noi</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Angajații care nu reușesc să-și creeze cont pot trimite o cerere. Creează-le contul din tab-ul "Creare Cont" apoi marchează cererea ca rezolvată.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nicio cerere de creare cont.
            </p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    În așteptare ({pendingRequests.length})
                  </h4>
                  {pendingRequests.map(req => (
                    <div key={req.id} className="p-4 bg-secondary/30 rounded-lg border border-border space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{req.full_name}</p>
                          <p className="text-sm text-muted-foreground">{req.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(req.created_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-primary border-primary/30 self-start">
                          În așteptare
                        </Badge>
                      </div>
                      {req.message && (
                        <p className="text-sm bg-muted/50 p-3 rounded-md">{req.message}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyCredentials(req)} className="text-xs">
                          {copiedId === req.id ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                          {copiedId === req.id ? 'Copiat!' : 'Copiază mesaj credențiale'}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => markResolved(req.id)}
                          disabled={resolvingId === req.id}
                        >
                          {resolvingId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                          )}
                          Marchează rezolvat
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resolvedRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4" />
                    Rezolvate ({resolvedRequests.length})
                  </h4>
                  {resolvedRequests.slice(0, 10).map(req => (
                    <div key={req.id} className="p-3 bg-muted/30 rounded-lg border border-border/50 opacity-70">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{req.full_name}</p>
                          <p className="text-xs text-muted-foreground">{req.email}</p>
                        </div>
                        <Badge variant="outline" className="text-muted-foreground text-xs">Rezolvat</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountRequestsPanel;
