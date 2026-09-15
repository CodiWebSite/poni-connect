import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { CheckCircle2, Heart, HelpCircle, Lightbulb, MessageSquare, Pin, Plus, Search, Send, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useDoctoralCoordinator } from '@/hooks/useDoctoralCoordinator';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const MANAGER_ROLES = ['super_admin', 'hr', 'sef_srus', 'director_institut', 'director_adjunct', 'secretar_stiintific'];

const CATEGORIES = [
  { value: 'intrebare', label: 'Întrebare', icon: HelpCircle },
  { value: 'discutie', label: 'Discuție', icon: MessageSquare },
  { value: 'resursa', label: 'Resursă utilă', icon: Lightbulb },
  { value: 'anunt', label: 'Anunț între colegi', icon: Pin },
];

type Topic = {
  id: string; author_id: string; title: string; body: string; category: string;
  is_pinned: boolean; is_resolved: boolean; reply_count: number; like_count: number;
  last_activity_at: string; created_at: string;
};
type Reply = { id: string; topic_id: string; author_id: string; body: string; is_answer: boolean; created_at: string };

const initials = (name?: string | null) => (name || 'Coleg').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const DoctoralCommunity = () => {
  const { user } = useAuth();
  const { role, hasDoctoralAccess, loading: roleLoading } = useUserRole();
  const { isCoordinator, loading: coordLoading } = useDoctoralCoordinator();
  const isManager = !!role && MANAGER_ROLES.includes(role);
  const isDoctorand = role === 'doctorand' || hasDoctoralAccess;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('toate');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', category: 'intrebare' });
  const [saving, setSaving] = useState(false);

  const loadNames = useCallback(async (ids: string[]) => {
    const missing = Array.from(new Set(ids)).filter((id) => id && !names[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from('profiles').select('user_id,full_name').in('user_id', missing);
    if (!data) return;
    setNames((prev) => {
      const next = { ...prev };
      data.forEach((row) => { next[row.user_id] = row.full_name || 'Coleg doctorand'; });
      return next;
    });
  }, [names]);

  const loadTopics = useCallback(async () => {
    const { data, error } = await supabase.from('doctoral_forum_topics')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('last_activity_at', { ascending: false });
    if (error) { toast.error('Discuțiile nu au putut fi încărcate'); return; }
    const list = (data || []) as Topic[];
    setTopics(list);
    await loadNames(list.map((item) => item.author_id));
    if (user) {
      const { data: likes } = await supabase.from('doctoral_forum_likes').select('topic_id').eq('user_id', user.id);
      setLikedIds(new Set((likes || []).map((row) => row.topic_id)));
    }
  }, [loadNames, user]);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  const loadReplies = useCallback(async (topicId: string) => {
    const { data } = await supabase.from('doctoral_forum_replies').select('*').eq('topic_id', topicId).order('created_at');
    const list = (data || []) as Reply[];
    setReplies((prev) => ({ ...prev, [topicId]: list }));
    await loadNames(list.map((item) => item.author_id));
  }, [loadNames]);

  const toggleTopic = async (topicId: string) => {
    if (openTopicId === topicId) { setOpenTopicId(null); return; }
    setOpenTopicId(topicId);
    setReplyDraft('');
    if (!replies[topicId]) await loadReplies(topicId);
  };

  const createTopic = async () => {
    if (!user || !draft.title.trim() || !draft.body.trim()) { toast.error('Completează titlul și mesajul'); return; }
    setSaving(true);
    const { error } = await supabase.from('doctoral_forum_topics').insert({
      author_id: user.id, title: draft.title.trim(), body: draft.body.trim(), category: draft.category,
    });
    setSaving(false);
    if (error) { toast.error('Discuția nu a putut fi publicată'); return; }
    toast.success('Discuția a fost publicată');
    setDraft({ title: '', body: '', category: 'intrebare' });
    setDialogOpen(false);
    await loadTopics();
  };

  const sendReply = async (topicId: string) => {
    if (!user || !replyDraft.trim()) return;
    const { error } = await supabase.from('doctoral_forum_replies').insert({ topic_id: topicId, author_id: user.id, body: replyDraft.trim() });
    if (error) { toast.error('Răspunsul nu a putut fi trimis'); return; }
    setReplyDraft('');
    await Promise.all([loadReplies(topicId), loadTopics()]);
  };

  const toggleLike = async (topic: Topic) => {
    if (!user) return;
    const liked = likedIds.has(topic.id);
    if (liked) await supabase.from('doctoral_forum_likes').delete().eq('topic_id', topic.id).eq('user_id', user.id);
    else await supabase.from('doctoral_forum_likes').insert({ topic_id: topic.id, user_id: user.id });
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) next.delete(topic.id); else next.add(topic.id);
      return next;
    });
    setTopics((prev) => prev.map((item) => item.id === topic.id ? { ...item, like_count: Math.max(0, item.like_count + (liked ? -1 : 1)) } : item));
  };

  const markResolved = async (topic: Topic) => {
    const { error } = await supabase.from('doctoral_forum_topics').update({ is_resolved: !topic.is_resolved }).eq('id', topic.id);
    if (error) { toast.error('Starea nu a putut fi schimbată'); return; }
    await loadTopics();
  };

  const markAnswer = async (reply: Reply) => {
    const { error } = await supabase.from('doctoral_forum_replies').update({ is_answer: !reply.is_answer }).eq('id', reply.id);
    if (error) { toast.error('Răspunsul nu a putut fi marcat'); return; }
    await loadReplies(reply.topic_id);
  };

  const visibleTopics = useMemo(() => {
    const term = search.trim().toLowerCase();
    return topics.filter((topic) => {
      if (filter !== 'toate' && topic.category !== filter) return false;
      if (!term) return true;
      return topic.title.toLowerCase().includes(term) || topic.body.toLowerCase().includes(term);
    });
  }, [topics, search, filter]);

  if (roleLoading || coordLoading) return null;
  if (role === 'doctorand_pending') return <Navigate to="/doctoral/pending" replace />;
  if (!isDoctorand && !isManager && !isCoordinator) return <Navigate to="/" replace />;

  const categoryMeta = (value: string) => CATEGORIES.find((item) => item.value === value) || CATEGORIES[1];

  return (
    <MainLayout title="Comunitatea doctoranzilor">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="ICMPP · Doctoranzi"
          title="Comunitatea doctoranzilor"
          description="Întrebări, răspunsuri și discuții doar între doctoranzi și conducătorii lor"
          icon={Users}
        />

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută în discuții" className="pl-9" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="toate">Toate categoriile</SelectItem>
              {CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Deschide o discuție</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Discuție nouă</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic-category">Categorie</Label>
                  <Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value })}>
                    <SelectTrigger id="topic-category"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topic-title">Titlu</Label>
                  <Input id="topic-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex: Cum se depune raportul de an?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topic-body">Mesaj</Label>
                  <Textarea id="topic-body" rows={6} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Descrie întrebarea sau subiectul discuției" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Renunță</Button>
                <Button onClick={createTopic} disabled={saving}>{saving ? 'Se publică...' : 'Publică'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {visibleTopics.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-3 h-10 w-10" />
            <p className="font-medium text-foreground">Nicio discuție încă</p>
            <p className="mt-1 text-sm">Fii primul care pune o întrebare colegilor doctoranzi.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {visibleTopics.map((topic) => {
              const meta = categoryMeta(topic.category);
              const Icon = meta.icon;
              const isOpen = openTopicId === topic.id;
              const topicReplies = replies[topic.id] || [];
              const canEditTopic = topic.author_id === user?.id || isManager;
              return (
                <Card key={topic.id} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10"><AvatarFallback>{initials(names[topic.author_id])}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1"><Icon className="h-3 w-3" />{meta.label}</Badge>
                          {topic.is_pinned && <Badge variant="secondary" className="gap-1"><Pin className="h-3 w-3" />Fixat</Badge>}
                          {topic.is_resolved && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Rezolvat</Badge>}
                        </div>
                        <h3 className="mt-2 text-base font-semibold leading-snug">{topic.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {names[topic.author_id] || 'Coleg doctorand'} · {format(parseISO(topic.created_at), 'd MMMM yyyy, HH:mm', { locale: ro })}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{topic.body}</p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => toggleLike(topic)} className={likedIds.has(topic.id) ? 'text-primary' : ''}>
                            <Heart className={`mr-1.5 h-4 w-4 ${likedIds.has(topic.id) ? 'fill-current' : ''}`} />{topic.like_count}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleTopic(topic.id)}>
                            <MessageSquare className="mr-1.5 h-4 w-4" />{topic.reply_count} {topic.reply_count === 1 ? 'răspuns' : 'răspunsuri'}
                          </Button>
                          {canEditTopic && (
                            <Button variant="ghost" size="sm" onClick={() => markResolved(topic)}>
                              <CheckCircle2 className="mr-1.5 h-4 w-4" />{topic.is_resolved ? 'Redeschide' : 'Marchează rezolvat'}
                            </Button>
                          )}
                        </div>

                        {isOpen && (
                          <div className="mt-4 space-y-4 border-t border-border pt-4">
                            {topicReplies.map((reply) => (
                              <div key={reply.id} className="flex items-start gap-3">
                                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials(names[reply.author_id])}</AvatarFallback></Avatar>
                                <div className="min-w-0 flex-1 rounded-lg bg-muted/50 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">{names[reply.author_id] || 'Coleg doctorand'}</span>
                                    <span className="text-xs text-muted-foreground">{format(parseISO(reply.created_at), 'd MMM yyyy, HH:mm', { locale: ro })}</span>
                                    {reply.is_answer && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Răspuns util</Badge>}
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">{reply.body}</p>
                                  {canEditTopic && (
                                    <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs" onClick={() => markAnswer(reply)}>
                                      {reply.is_answer ? 'Anulează marcajul' : 'Marchează ca răspuns util'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                            <div className="flex items-start gap-2">
                              <Textarea rows={2} value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder="Scrie un răspuns colegial..." />
                              <Button size="icon" onClick={() => sendReply(topic.id)} disabled={!replyDraft.trim()}><Send className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default DoctoralCommunity;
