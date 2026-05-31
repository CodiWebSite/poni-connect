import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, Megaphone, Users, Smartphone } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Target = 'all' | 'app_installed' | 'department';
type NotifType = 'info' | 'success' | 'warning' | 'error';

export default function BroadcastNotificationPanel() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotifType>('info');
  const [target, setTarget] = useState<Target>('all');
  const [department, setDepartment] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Titlul și mesajul sunt obligatorii');
      return;
    }
    setSending(true);
    try {
      let userIds: string[] = [];

      if (target === 'app_installed') {
        // Users with at least one active push subscription or native token
        const [{ data: webSubs }, { data: tokens }] = await Promise.all([
          supabase.from('push_subscriptions').select('user_id'),
          supabase.from('push_tokens').select('user_id'),
        ]);
        const set = new Set<string>();
        webSubs?.forEach((s: any) => s.user_id && set.add(s.user_id));
        tokens?.forEach((t: any) => t.user_id && set.add(t.user_id));
        userIds = Array.from(set);
      } else if (target === 'department') {
        if (!department.trim()) {
          toast.error('Specifică departamentul');
          setSending(false);
          return;
        }
        const { data } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('department', department.trim());
        userIds = (data || []).map((p: any) => p.user_id).filter(Boolean);
      } else {
        const { data } = await supabase.from('profiles').select('user_id');
        userIds = (data || []).map((p: any) => p.user_id).filter(Boolean);
      }

      if (userIds.length === 0) {
        toast.warning('Niciun destinatar găsit');
        setSending(false);
        return;
      }

      // Insert in batches of 500 (trigger will dispatch push for each row)
      const rows = userIds.map((uid) => ({
        user_id: uid,
        title: title.trim(),
        message: message.trim(),
        type,
      }));

      const batchSize = 500;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from('notifications').insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }

      toast.success(`Notificare trimisă către ${inserted} utilizatori`);
      setTitle('');
      setMessage('');
    } catch (e: any) {
      console.error(e);
      toast.error('Eroare la trimitere: ' + (e?.message || 'necunoscută'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="w-5 h-5" /> Broadcast Notificări Push
        </CardTitle>
        <CardDescription>
          Trimite notificări personalizate către toți utilizatorii. Apare în aplicație și ca push
          pe browser/telefon pentru cei care au instalat aplicația.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Titlu</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Mentenanță programată"
            maxLength={120}
          />
        </div>

        <div className="grid gap-2">
          <Label>Mesaj</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Conținutul notificării..."
            rows={4}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">{message.length}/500</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Tip</Label>
            <Select value={type} onValueChange={(v) => setType(v as NotifType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Succes</SelectItem>
                <SelectItem value="warning">Avertizare</SelectItem>
                <SelectItem value="error">Eroare</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Destinatari</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as Target)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Toți angajații</span>
                </SelectItem>
                <SelectItem value="app_installed">
                  <span className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Doar cei cu aplicația instalată</span>
                </SelectItem>
                <SelectItem value="department">Un departament</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {target === 'department' && (
          <div className="grid gap-2">
            <Label>Departament (exact)</Label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="ex: Oficiu juridic"
            />
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={sending || !title.trim() || !message.trim()} className="gap-2">
              <Send className="w-4 h-4" />
              {sending ? 'Se trimite...' : 'Trimite notificarea'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmi trimiterea?</AlertDialogTitle>
              <AlertDialogDescription>
                Notificarea „{title}" va fi trimisă către{' '}
                {target === 'all' && 'TOȚI angajații din intranet'}
                {target === 'app_installed' && 'toți utilizatorii care au aplicația instalată'}
                {target === 'department' && `departamentul „${department}"`}
                . Această acțiune nu poate fi anulată.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anulează</AlertDialogCancel>
              <AlertDialogAction onClick={handleSend}>Trimite</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
