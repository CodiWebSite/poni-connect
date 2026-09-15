import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Clock3, LogOut, MailCheck, MessageSquareText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const DoctoralPending = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ id: string; status: string; admin_notes: string | null } | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('doctoral_profiles').select('id,status,admin_notes').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { setProfile(data); setLoading(false); });
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!loading && profile?.status === 'active') return <Navigate to="/doctoral" replace />;

  const submitCompletion = async () => {
    if (!profile || !notes.trim()) return;
    const { error } = await supabase.from('doctoral_profiles').update({ admin_notes: notes.trim(), status: 'pending' }).eq('id', profile.id);
    if (error) toast.error('Completările nu au putut fi trimise');
    else { toast.success('Completările au fost trimise'); setProfile({ ...profile, status: 'pending', admin_notes: notes.trim() }); setNotes(''); }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo-icmpp.png" alt="ICMPP" className="h-11 w-11 object-contain" /><div><p className="font-display text-lg font-bold">ICMPP</p><p className="text-xs text-muted-foreground">Spațiul Doctoral</p></div></div>
          <Button variant="ghost" onClick={() => signOut()}><LogOut className="mr-2 h-4 w-4" />Deconectare</Button>
        </div>
        <section className="border-l-4 border-primary bg-card px-6 py-8 shadow-sm sm:px-10">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {profile?.status === 'changes_requested' ? <MessageSquareText className="h-7 w-7" /> : <Clock3 className="h-7 w-7" />}
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Cerere doctorand</p>
          <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{profile?.status === 'changes_requested' ? 'Sunt necesare completări' : 'Cererea este în verificare'}</h1>
          <p className="mt-3 text-muted-foreground">Adresa instituțională trebuie confirmată, apoi un administrator verifică datele academice. Vei primi o notificare imediat ce accesul este aprobat.</p>
          <div className="mt-6 flex items-start gap-3 border-t border-border pt-5 text-sm"><MailCheck className="mt-0.5 h-5 w-5 text-success" /><div><p className="font-medium">Verifică mesajul de confirmare</p><p className="text-muted-foreground">După confirmare, nu trebuie să retrimiți cererea.</p></div></div>
          {profile?.status === 'changes_requested' && (
            <div className="mt-7 space-y-3 rounded-md border border-warning/30 bg-warning/5 p-4">
              <p className="text-sm font-medium">Mesaj de la administrator</p><p className="text-sm text-muted-foreground">{profile.admin_notes}</p>
              <Label htmlFor="completion">Răspunsul tău</Label><Textarea id="completion" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Scrie completările solicitate..." />
              <Button onClick={submitCompletion} disabled={!notes.trim()}>Trimite completările</Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default DoctoralPending;