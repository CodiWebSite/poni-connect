import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Search, Loader2, Trash2, Plus, UserPlus } from 'lucide-react';

interface Publisher {
  id: string;
  user_id: string;
  created_at: string;
  full_name: string;
  department: string | null;
}

interface ProfileOption {
  user_id: string;
  full_name: string;
  department: string | null;
}

const EventPublishersPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [pubRes, profRes] = await Promise.all([
      supabase.from('event_publishers').select('id, user_id, created_at'),
      supabase.from('profiles').select('user_id, full_name, department'),
    ]);

    const pubs = pubRes.data || [];
    const profs = profRes.data || [];

    const enriched: Publisher[] = pubs.map(p => {
      const prof = profs.find(pr => pr.user_id === p.user_id);
      return { ...p, full_name: prof?.full_name || 'Necunoscut', department: prof?.department || null };
    });

    setPublishers(enriched);
    setProfiles(profs);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const addPublisher = async (userId: string) => {
    setAdding(true);
    const { error } = await supabase.from('event_publishers').insert({ user_id: userId, added_by: user?.id });
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut adăuga utilizatorul.', variant: 'destructive' });
    } else {
      toast({ title: 'Adăugat', description: 'Utilizatorul poate acum gestiona evenimente.' });
      await fetchData();
    }
    setAdding(false);
  };

  const removePublisher = async (id: string) => {
    const { error } = await supabase.from('event_publishers').delete().eq('id', id);
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut elimina utilizatorul.', variant: 'destructive' });
    } else {
      toast({ title: 'Eliminat', description: 'Dreptul de a gestiona evenimente a fost revocat.' });
      await fetchData();
    }
  };

  const publisherUserIds = new Set(publishers.map(p => p.user_id));
  const availableProfiles = profiles
    .filter(p => !publisherUserIds.has(p.user_id))
    .filter(p => p.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Drepturi Gestionare Evenimente
        </CardTitle>
        <CardDescription>
          Utilizatorii cu roluri superioare pot gestiona evenimente implicit. 
          Aici poți acorda acces suplimentar angajaților obișnuiți.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Utilizatori cu acces suplimentar</h3>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : publishers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nu există utilizatori adăugați manual.</p>
          ) : (
            <div className="space-y-2">
              {publishers.map(pub => (
                <div key={pub.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {pub.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{pub.full_name}</p>
                      <p className="text-xs text-muted-foreground">{pub.department || 'Fără departament'}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removePublisher(pub.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Adaugă utilizator
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Caută angajat după nume..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          {searchQuery.length >= 2 && (
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2">
              {availableProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Nu s-au găsit rezultate</p>
              ) : (
                availableProfiles.slice(0, 10).map(prof => (
                  <div key={prof.user_id} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{prof.full_name}</p>
                      <p className="text-xs text-muted-foreground">{prof.department || 'Fără departament'}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addPublisher(prof.user_id)} disabled={adding}>
                      {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                      Adaugă
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EventPublishersPanel;
