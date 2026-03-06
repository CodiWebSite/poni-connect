import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  Plus, Film, Music, Gamepad2, Brain, Palette, Coffee, Sparkles,
  CalendarDays, MapPin, Users, Check, X, HelpCircle, Trash2,
  UserPlus, Crown, Edit, ChevronsUpDown
} from 'lucide-react';

type ActivityCategory = 'film' | 'muzica' | 'jocuri' | 'quiz' | 'creativ' | 'socializare' | 'altele';

interface Activity {
  id: string;
  title: string;
  description: string | null;
  category: ActivityCategory;
  location: string | null;
  scheduled_at: string | null;
  max_participants: number | null;
  image_url: string | null;
  created_by: string;
  created_at: string;
  status: string;
}

interface ActivityResponse {
  id: string;
  activity_id: string;
  user_id: string;
  response: string;
}

interface Organizer {
  id: string;
  user_id: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
}

const categoryConfig: Record<ActivityCategory, { label: string; icon: typeof Film; color: string }> = {
  film: { label: 'Film / Proiecție', icon: Film, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  muzica: { label: 'Muzică', icon: Music, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  jocuri: { label: 'Jocuri', icon: Gamepad2, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  quiz: { label: 'Quiz', icon: Brain, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  creativ: { label: 'Activitate Creativă', icon: Palette, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  socializare: { label: 'Socializare', icon: Coffee, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  altele: { label: 'Altele', icon: Sparkles, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300' },
};

const RecreationalActivities = () => {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const { toast } = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [responses, setResponses] = useState<ActivityResponse[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [showOrgManage, setShowOrgManage] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: '', description: '', category: 'socializare' as ActivityCategory,
    location: '', scheduled_at: '', max_participants: '',
  });

  // Organizer add
  const [selectedUserId, setSelectedUserId] = useState('');
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [actRes, respRes, orgRes, allProfRes] = await Promise.all([
      supabase.from('recreational_activities').select('*').order('scheduled_at', { ascending: true, nullsFirst: false }),
      supabase.from('activity_responses').select('*'),
      supabase.from('activity_organizers').select('*'),
      supabase.from('profiles').select('user_id, full_name, avatar_url, department').order('full_name'),
    ]);

    const acts = (actRes.data || []) as Activity[];
    const resps = (respRes.data || []) as ActivityResponse[];
    const orgs = (orgRes.data || []) as Organizer[];
    const allProfs = (allProfRes.data || []) as Profile[];

    setActivities(acts);
    setResponses(resps);
    setOrganizers(orgs);
    setAllProfiles(allProfs);

    // Check if current user is organizer
    if (user) {
      setIsOrganizer(isSuperAdmin || orgs.some(o => o.user_id === user.id));
    }

    // Build profiles map
    const map: Record<string, Profile> = {};
    allProfs.forEach(p => { map[p.user_id] = p; });
    setProfiles(map);

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user, isSuperAdmin]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('activities-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_responses' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recreational_activities' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!user || !form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      location: form.location.trim() || null,
      scheduled_at: form.scheduled_at || null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      created_by: user.id,
    };

    let error;
    if (editActivity) {
      const { error: e } = await supabase.from('recreational_activities').update(payload).eq('id', editActivity.id);
      error = e;
    } else {
      const { error: e } = await supabase.from('recreational_activities').insert(payload);
      error = e;
    }

    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editActivity ? 'Activitate actualizată' : 'Activitate creată', description: 'Succes!' });
      setShowCreate(false);
      setEditActivity(null);
      setForm({ title: '', description: '', category: 'socializare', location: '', scheduled_at: '', max_participants: '' });
      fetchAll();
    }
  };

  const handleRsvp = async (activityId: string, response: string) => {
    if (!user) return;
    const existing = responses.find(r => r.activity_id === activityId && r.user_id === user.id);

    if (existing && existing.response === response) {
      // Remove response
      await supabase.from('activity_responses').delete().eq('id', existing.id);
    } else if (existing) {
      await supabase.from('activity_responses').update({ response }).eq('id', existing.id);
    } else {
      await supabase.from('activity_responses').insert({ activity_id: activityId, user_id: user.id, response });
    }
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('recreational_activities').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Activitate ștearsă' });
      fetchAll();
    }
  };

  const handleAddOrganizer = async () => {
    if (!selectedUserId) return;
    // Check if already an organizer
    if (organizers.some(o => o.user_id === selectedUserId)) {
      toast({ title: 'Deja organizator', description: 'Acest utilizator este deja organizator.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('activity_organizers').insert({ user_id: selectedUserId, added_by: user?.id });
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      const prof = profiles[selectedUserId];
      toast({ title: 'Organizator adăugat', description: prof?.full_name || '' });
      setSelectedUserId('');
      fetchAll();
    }
  };

  const handleRemoveOrganizer = async (orgId: string) => {
    await supabase.from('activity_organizers').delete().eq('id', orgId);
    fetchAll();
  };

  const getResponseCounts = (activityId: string) => {
    const actResps = responses.filter(r => r.activity_id === activityId);
    return {
      particip: actResps.filter(r => r.response === 'particip').length,
      nu_particip: actResps.filter(r => r.response === 'nu_particip').length,
      poate: actResps.filter(r => r.response === 'poate').length,
    };
  };

  const getUserResponse = (activityId: string) => {
    if (!user) return null;
    return responses.find(r => r.activity_id === activityId && r.user_id === user.id)?.response || null;
  };

  const getParticipants = (activityId: string) => {
    return responses.filter(r => r.activity_id === activityId && r.response === 'particip')
      .map(r => profiles[r.user_id]).filter(Boolean);
  };

  const openEdit = (act: Activity) => {
    setEditActivity(act);
    setForm({
      title: act.title,
      description: act.description || '',
      category: act.category,
      location: act.location || '',
      scheduled_at: act.scheduled_at ? act.scheduled_at.slice(0, 16) : '',
      max_participants: act.max_participants?.toString() || '',
    });
    setShowCreate(true);
  };

  const upcomingActivities = activities.filter(a => {
    if (!a.scheduled_at) return true;
    return new Date(a.scheduled_at) >= new Date();
  });

  const pastActivities = activities.filter(a => {
    if (!a.scheduled_at) return false;
    return new Date(a.scheduled_at) < new Date();
  });

  return (
    <MainLayout title="Activități Recreative">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-muted-foreground">
              Activități de relaxare și socializare pentru colectivul ICMPP 🎉
            </p>
          </div>
          <div className="flex gap-2">
            {isSuperAdmin && (
              <Button variant="outline" onClick={() => setShowOrgManage(true)}>
                <Crown className="w-4 h-4 mr-2" />
                Organizatori
              </Button>
            )}
            {(isOrganizer || isSuperAdmin) && (
              <Button onClick={() => { setEditActivity(null); setForm({ title: '', description: '', category: 'socializare', location: '', scheduled_at: '', max_participants: '' }); setShowCreate(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Activitate Nouă
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList>
            <TabsTrigger value="upcoming">Viitoare ({upcomingActivities.length})</TabsTrigger>
            <TabsTrigger value="past">Trecute ({pastActivities.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4 mt-4">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader><div className="h-6 bg-muted rounded w-3/4" /></CardHeader>
                    <CardContent><div className="h-20 bg-muted rounded" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : upcomingActivities.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">Nicio activitate programată</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {isOrganizer ? 'Creează prima activitate!' : 'Revin-o mai târziu!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingActivities.map(act => (
                  <ActivityCard
                    key={act.id}
                    activity={act}
                    profiles={profiles}
                    counts={getResponseCounts(act.id)}
                    userResponse={getUserResponse(act.id)}
                    participants={getParticipants(act.id)}
                    onRsvp={handleRsvp}
                    onDelete={handleDelete}
                    onEdit={openEdit}
                    canManage={(user?.id === act.created_by && isOrganizer) || isSuperAdmin}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4 mt-4">
            {pastActivities.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nicio activitate trecută.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pastActivities.map(act => (
                  <ActivityCard
                    key={act.id}
                    activity={act}
                    profiles={profiles}
                    counts={getResponseCounts(act.id)}
                    userResponse={getUserResponse(act.id)}
                    participants={getParticipants(act.id)}
                    onRsvp={handleRsvp}
                    onDelete={handleDelete}
                    onEdit={openEdit}
                    canManage={false}
                    isPast
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setEditActivity(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editActivity ? 'Editare Activitate' : 'Activitate Nouă'}</DialogTitle>
            <DialogDescription>Completează detaliile activității recreative.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titlu *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ex: Seară de board games" />
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalii despre activitate..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as ActivityCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nr. maxim participanți</Label>
                <Input type="number" value={form.max_participants} onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))} placeholder="Nelimitat" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Locație</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="ex: Sala de conferințe" />
              </div>
              <div>
                <Label>Data și ora</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditActivity(null); }}>Anulează</Button>
            <Button onClick={handleCreateOrUpdate} disabled={!form.title.trim()}>
              {editActivity ? 'Salvează' : 'Creează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organizers Management Dialog */}
      <Dialog open={showOrgManage} onOpenChange={setShowOrgManage}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestionare Organizatori</DialogTitle>
            <DialogDescription>Adaugă sau elimină persoanele care pot crea activități.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                    {selectedUserId ? profiles[selectedUserId]?.full_name || 'Selectat' : 'Selectează angajat...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Caută angajat..." />
                    <CommandList>
                      <CommandEmpty>Niciun rezultat.</CommandEmpty>
                      <CommandGroup>
                        {allProfiles
                          .filter(p => !organizers.some(o => o.user_id === p.user_id))
                          .map(p => (
                            <CommandItem
                              key={p.user_id}
                              value={`${p.full_name} ${p.department || ''}`}
                              onSelect={() => { setSelectedUserId(p.user_id); setOrgPopoverOpen(false); }}
                              className="flex items-center gap-2"
                            >
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={p.avatar_url || ''} />
                                <AvatarFallback className="text-[9px]">{p.full_name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm">{p.full_name}</span>
                                {p.department && <span className="text-xs text-muted-foreground ml-1">({p.department})</span>}
                              </div>
                              {selectedUserId === p.user_id && <Check className="w-4 h-4 text-primary" />}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button size="sm" onClick={handleAddOrganizer} disabled={!selectedUserId}>
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {organizers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Niciun organizator adăugat încă.</p>
              ) : (
                organizers.map(org => {
                  const prof = profiles[org.user_id];
                  return (
                    <div key={org.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={prof?.avatar_url || ''} />
                          <AvatarFallback className="text-xs">{prof?.full_name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{prof?.full_name || 'Necunoscut'}</p>
                          <p className="text-xs text-muted-foreground">{prof?.department || ''}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveOrganizer(org.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

// Activity Card Component
function ActivityCard({
  activity, profiles, counts, userResponse, participants, onRsvp, onDelete, onEdit, canManage, isPast = false,
}: {
  activity: Activity;
  profiles: Record<string, Profile>;
  counts: { particip: number; nu_particip: number; poate: number };
  userResponse: string | null;
  participants: Profile[];
  onRsvp: (id: string, response: string) => void;
  onDelete: (id: string) => void;
  onEdit: (a: Activity) => void;
  canManage: boolean;
  isPast?: boolean;
}) {
  const cat = categoryConfig[activity.category];
  const CatIcon = cat.icon;
  const creator = profiles[activity.created_by];
  const isFull = activity.max_participants ? counts.particip >= activity.max_participants : false;

  return (
    <Card className={`transition-all hover:shadow-md ${isPast ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className={`p-2 rounded-lg ${cat.color}`}>
              <CatIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight">{activity.title}</CardTitle>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="outline" className="text-[10px] px-1.5">{cat.label}</Badge>
              </div>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(activity)}>
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(activity.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {activity.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{activity.description}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {activity.scheduled_at && (
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              {format(new Date(activity.scheduled_at), "d MMM yyyy, HH:mm", { locale: ro })}
            </span>
          )}
          {activity.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {activity.location}
            </span>
          )}
          {activity.max_participants && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {counts.particip}/{activity.max_participants} locuri
            </span>
          )}
        </div>

        {/* Participants avatars */}
        {participants.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map((p, i) => (
                <Avatar key={i} className="w-6 h-6 border-2 border-background">
                  <AvatarImage src={p.avatar_url || ''} />
                  <AvatarFallback className="text-[9px]">{p.full_name?.charAt(0)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            {participants.length > 5 && (
              <span className="text-xs text-muted-foreground ml-1">+{participants.length - 5}</span>
            )}
          </div>
        )}

        {creator && (
          <p className="text-xs text-muted-foreground/70">
            Organizator: {creator.full_name}
          </p>
        )}
      </CardContent>

      {!isPast && (
        <CardFooter className="pt-0 pb-4">
          <div className="flex gap-2 w-full">
            <Button
              size="sm"
              variant={userResponse === 'particip' ? 'default' : 'outline'}
              className={`flex-1 ${userResponse === 'particip' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
              onClick={() => onRsvp(activity.id, 'particip')}
              disabled={isFull && userResponse !== 'particip'}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Particip {counts.particip > 0 && `(${counts.particip})`}
            </Button>
            <Button
              size="sm"
              variant={userResponse === 'poate' ? 'default' : 'outline'}
              className={`flex-1 ${userResponse === 'poate' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
              onClick={() => onRsvp(activity.id, 'poate')}
            >
              <HelpCircle className="w-3.5 h-3.5 mr-1" />
              Poate {counts.poate > 0 && `(${counts.poate})`}
            </Button>
            <Button
              size="sm"
              variant={userResponse === 'nu_particip' ? 'default' : 'outline'}
              className={`flex-1 ${userResponse === 'nu_particip' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
              onClick={() => onRsvp(activity.id, 'nu_particip')}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Nu {counts.nu_particip > 0 && `(${counts.nu_particip})`}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

export default RecreationalActivities;
