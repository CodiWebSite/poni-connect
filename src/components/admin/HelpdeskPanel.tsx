import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Headset, Loader2, Clock, CheckCircle2, MessageSquare, Trash2, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface Ticket {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  open: 'Deschis',
  in_progress: 'În lucru',
  resolved: 'Rezolvat',
  closed: 'Închis',
};

const statusColors: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-muted text-muted-foreground',
};

const HelpdeskPanel = () => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from('helpdesk_tickets' as any)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setTickets(data as any);
    if (error) console.error('Error fetching tickets:', error);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const updateStatus = async (id: string, status: string) => {
    setSaving(id);
    const updates: any = { status };
    if (notes[id]) updates.admin_notes = notes[id];

    const { error } = await supabase
      .from('helpdesk_tickets' as any)
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut actualiza tichetul.', variant: 'destructive' });
    } else {
      toast({ title: 'Actualizat', description: `Tichetul a fost marcat ca „${statusLabels[status] || status}".` });
      fetchTickets();
    }
    setSaving(null);
  };

  const saveNotes = async (id: string) => {
    setSaving(id);
    const { error } = await supabase
      .from('helpdesk_tickets' as any)
      .update({ admin_notes: notes[id] || null } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-au putut salva notițele.', variant: 'destructive' });
    } else {
      toast({ title: 'Salvat', description: 'Notițele au fost actualizate.' });
      fetchTickets();
    }
    setSaving(null);
  };

  const deleteTicket = async (id: string) => {
    setSaving(id);
    const { error } = await supabase
      .from('helpdesk_tickets' as any)
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge tichetul.', variant: 'destructive' });
    } else {
      toast({ title: 'Șters', description: 'Tichetul a fost eliminat.' });
      setTickets(prev => prev.filter(t => t.id !== id));
    }
    setSaving(null);
  };

  const openCount = tickets.filter(t => t.status === 'open').length;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headset className="w-5 h-5 text-primary" />
          HelpDesk IT
          {openCount > 0 && (
            <Badge variant="destructive" className="ml-2">{openCount} noi</Badge>
          )}
        </CardTitle>
        <CardDescription>Mesaje primite de la angajați prin formularul de contact IT</CardDescription>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nu există tichete HelpDesk.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{ticket.name}</span>
                      <Badge className={statusColors[ticket.status] || statusColors.open}>
                        {statusLabels[ticket.status] || ticket.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <a href={`mailto:${ticket.email}`} className="hover:text-primary hover:underline">
                          {ticket.email}
                        </a>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(ticket.created_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
                      </span>
                    </div>
                    {ticket.subject && ticket.subject !== 'General' && (
                      <p className="text-xs text-primary font-medium mt-1">{ticket.subject}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                    >
                      {expandedId === ticket.id ? 'Ascunde' : 'Detalii'}
                    </Button>
                  </div>
                </div>

                {expandedId === ticket.id && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Notițe admin:</p>
                      <Textarea
                        placeholder="Adaugă notițe interne..."
                        value={notes[ticket.id] ?? ticket.admin_notes ?? ''}
                        onChange={(e) => setNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveNotes(ticket.id)}
                          disabled={saving === ticket.id}
                        >
                          {saving === ticket.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Salvează notițe
                        </Button>
                        {ticket.status === 'open' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateStatus(ticket.id, 'in_progress')}
                            disabled={saving === ticket.id}
                          >
                            Marchează „În lucru"
                          </Button>
                        )}
                        {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => updateStatus(ticket.id, 'resolved')}
                            disabled={saving === ticket.id}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Rezolvat
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteTicket(ticket.id)}
                          disabled={saving === ticket.id}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Șterge
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HelpdeskPanel;
