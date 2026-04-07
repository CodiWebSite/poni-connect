
import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import {
  Lightbulb, Send, ThumbsUp, MessageSquare, Search, Filter, TrendingUp,
  Eye, EyeOff, Sparkles, ArrowUp, BarChart3, Clock, CheckCircle2, XCircle,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, Reply, User, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const CATEGORIES = [
  'Platformă', 'HR', 'Concedii', 'Administrație internă', 'IT / suport',
  'Activități recreative', 'Comunicare internă', 'Spațiu de lucru / organizare',
  'Securitate', 'Alte idei'
];

const TYPES = [
  { value: 'idea', label: 'Idee', icon: Lightbulb },
  { value: 'feedback', label: 'Feedback', icon: MessageSquare },
  { value: 'problem', label: 'Problemă observată', icon: AlertTriangle },
  { value: 'improvement', label: 'Sugestie de îmbunătățire', icon: TrendingUp },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'Nouă', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: Sparkles },
  in_review: { label: 'În analiză', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: Eye },
  approved: { label: 'Aprobată', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 },
  in_progress: { label: 'În lucru', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', icon: Loader2 },
  implemented: { label: 'Implementată', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', icon: CheckCircle2 },
  rejected: { label: 'Respinsă', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Scăzută', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Medie', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  high: { label: 'Ridicată', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

interface SuggestionItem {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  category: string;
  type: string;
  priority: string;
  target_module: string | null;
  is_anonymous: boolean;
  status: string;
  admin_response: string | null;
  admin_responded_by: string | null;
  admin_responded_at: string | null;
  vote_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author_name?: string;
  responder_name?: string;
}

interface Comment {
  id: string;
  suggestion_id: string;
  user_id: string;
  content: string;
  is_admin_reply: boolean;
  created_at: string;
  author_name?: string;
}

export default function Suggestions() {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const { toast } = useToast();

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Platformă');
  const [type, setType] = useState('idea');
  const [priority, setPriority] = useState('medium');
  const [targetModule, setTargetModule] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'most_voted'>('newest');

  // Expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Admin respond
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('in_review');

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // Fetch profile names
    const userIds = [...new Set((data || []).filter(s => s.user_id).map(s => s.user_id!))];
    const responderIds = [...new Set((data || []).filter(s => s.admin_responded_by).map(s => s.admin_responded_by!))];
    const allIds = [...new Set([...userIds, ...responderIds])];

    let profileMap = new Map<string, string>();
    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allIds);
      profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name || 'Necunoscut']) || []);
    }

    const enriched: SuggestionItem[] = (data || []).map(s => ({
      ...s,
      type: s.type as string,
      priority: s.priority as string,
      status: s.status as string,
      author_name: s.is_anonymous ? 'Anonim' : (s.user_id ? profileMap.get(s.user_id) || 'Necunoscut' : 'Anonim'),
      responder_name: s.admin_responded_by ? profileMap.get(s.admin_responded_by) : undefined,
    }));

    setSuggestions(enriched);

    // Fetch user votes
    const { data: votes } = await supabase
      .from('suggestion_votes')
      .select('suggestion_id')
      .eq('user_id', user.id);
    setMyVotes(new Set(votes?.map(v => v.suggestion_id) || []));

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !description.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from('suggestions').insert({
      user_id: isAnonymous ? null : user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      type: type as any,
      priority: priority as any,
      target_module: targetModule.trim() || null,
      is_anonymous: isAnonymous,
    });

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut trimite.', variant: 'destructive' });
    } else {
      toast({ title: '✨ Mulțumim!', description: 'Ideea ta a fost trimisă cu succes.' });
      setTitle(''); setDescription(''); setCategory('Platformă'); setType('idea');
      setPriority('medium'); setTargetModule(''); setIsAnonymous(false);
      fetchSuggestions();
    }
    setSubmitting(false);
  };

  const handleVote = async (suggestionId: string) => {
    if (!user) return;
    const hasVoted = myVotes.has(suggestionId);

    if (hasVoted) {
      await supabase.from('suggestion_votes').delete()
        .eq('suggestion_id', suggestionId).eq('user_id', user.id);
      setMyVotes(prev => { const n = new Set(prev); n.delete(suggestionId); return n; });
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, vote_count: Math.max(0, s.vote_count - 1) } : s));
    } else {
      await supabase.from('suggestion_votes').insert({ suggestion_id: suggestionId, user_id: user.id });
      setMyVotes(prev => new Set(prev).add(suggestionId));
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, vote_count: s.vote_count + 1 } : s));
    }
  };

  const loadComments = async (suggestionId: string) => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('suggestion_comments')
      .select('*')
      .eq('suggestion_id', suggestionId)
      .order('created_at', { ascending: true });

    const userIds = [...new Set((data || []).map(c => c.user_id))];
    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, full_name').in('user_id', userIds);
      profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name || 'Necunoscut']) || []);
    }

    setComments((data || []).map(c => ({ ...c, author_name: profileMap.get(c.user_id) || 'Necunoscut' })));
    setLoadingComments(false);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setComments([]);
    } else {
      setExpandedId(id);
      loadComments(id);
    }
  };

  const handleAddComment = async (suggestionId: string) => {
    if (!user || !commentText.trim()) return;
    await supabase.from('suggestion_comments').insert({
      suggestion_id: suggestionId,
      user_id: user.id,
      content: commentText.trim(),
      is_admin_reply: isSuperAdmin,
    });
    setCommentText('');
    loadComments(suggestionId);
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, comment_count: s.comment_count + 1 } : s));
  };

  const handleAdminRespond = async (id: string) => {
    if (!responseText.trim()) return;
    await supabase.from('suggestions').update({
      status: responseStatus as any,
      admin_response: responseText.trim(),
      admin_responded_by: user?.id,
      admin_responded_at: new Date().toISOString(),
    }).eq('id', id);
    setRespondingTo(null); setResponseText(''); setResponseStatus('in_review');
    toast({ title: 'Răspuns trimis', description: 'Statusul a fost actualizat.' });
    fetchSuggestions();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('suggestions').delete().eq('id', id);
    toast({ title: 'Ștearsă', description: 'Sugestia a fost eliminată.' });
    fetchSuggestions();
  };

  // Filtered & sorted
  const filteredSuggestions = suggestions
    .filter(s => {
      if (filterCategory !== 'all' && s.category !== filterCategory) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'most_voted') return b.vote_count - a.vote_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const mySuggestions = suggestions.filter(s => s.user_id === user?.id);

  // Stats
  const stats = {
    total: suggestions.length,
    new: suggestions.filter(s => s.status === 'new').length,
    inReview: suggestions.filter(s => s.status === 'in_review').length,
    implemented: suggestions.filter(s => s.status === 'implemented').length,
    topVoted: [...suggestions].sort((a, b) => b.vote_count - a.vote_count).slice(0, 3),
  };

  const renderCard = (s: SuggestionItem) => {
    const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.new;
    const StatusIcon = statusCfg.icon;
    const priorityCfg = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.medium;
    const typeCfg = TYPES.find(t => t.value === s.type);
    const TypeIcon = typeCfg?.icon || Lightbulb;
    const voted = myVotes.has(s.id);
    const isExpanded = expandedId === s.id;
    const canDelete = (s.user_id === user?.id && s.status === 'new') || isSuperAdmin;

    return (
      <Card key={s.id} className="group hover:shadow-lg transition-all duration-300 border-border/60">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {/* Vote button */}
            <div className="flex flex-col items-center gap-1 pt-1">
              <Button
                variant={voted ? 'default' : 'outline'}
                size="icon"
                className={`h-10 w-10 rounded-full transition-all ${voted ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'hover:border-primary hover:text-primary'}`}
                onClick={() => handleVote(s.id)}
              >
                <ArrowUp className="w-5 h-5" />
              </Button>
              <span className={`text-sm font-bold ${voted ? 'text-primary' : 'text-muted-foreground'}`}>
                {s.vote_count}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-base leading-tight mb-1.5">{s.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                    <Badge variant="outline" className="text-xs font-normal">{s.category}</Badge>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <TypeIcon className="w-3 h-3" />
                      {typeCfg?.label}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${priorityCfg.color}`}>{priorityCfg.label}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{s.description}</p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {s.author_name}
                  </span>
                  <span>{format(new Date(s.created_at), 'dd MMM yyyy', { locale: ro })}</span>
                </div>
                <div className="flex items-center gap-3">
                  {s.admin_response && (
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <Reply className="w-3 h-3" /> Răspuns oficial
                    </span>
                  )}
                  <button
                    onClick={() => toggleExpand(s.id)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {s.comment_count}
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {canDelete && (
                    <button onClick={() => handleDelete(s.id)} className="hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Admin response */}
              {s.admin_response && (
                <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Reply className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">Răspuns oficial</span>
                    {s.responder_name && <span className="text-xs text-muted-foreground">— {s.responder_name}</span>}
                  </div>
                  <p className="text-sm">{s.admin_response}</p>
                </div>
              )}

              {/* Admin respond form */}
              {isSuperAdmin && respondingTo === s.id && (
                <div className="mt-3 p-3 border rounded-lg space-y-3 bg-muted/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Status nou</Label>
                      <Select value={responseStatus} onValueChange={setResponseStatus}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Textarea value={responseText} onChange={e => setResponseText(e.target.value)}
                    placeholder="Răspuns oficial..." rows={2} className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAdminRespond(s.id)}>Trimite</Button>
                    <Button size="sm" variant="outline" onClick={() => setRespondingTo(null)}>Anulează</Button>
                  </div>
                </div>
              )}

              {isSuperAdmin && !respondingTo && (
                <Button size="sm" variant="ghost" className="mt-2 text-xs h-7" onClick={() => { setRespondingTo(s.id); setResponseStatus(s.status); }}>
                  <Reply className="w-3 h-3 mr-1" /> Răspunde oficial
                </Button>
              )}

              {/* Expanded comments */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {loadingComments ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Se încarcă...</p>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Niciun comentariu încă.</p>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className={`p-2.5 rounded-lg text-sm ${c.is_admin_reply ? 'bg-primary/5 border border-primary/10' : 'bg-muted/50'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-xs">{c.author_name}</span>
                          {c.is_admin_reply && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Admin</Badge>}
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
                          </span>
                        </div>
                        <p className="text-xs">{c.content}</p>
                      </div>
                    ))
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Scrie un comentariu..."
                      className="text-sm h-8"
                      onKeyDown={e => e.key === 'Enter' && handleAddComment(s.id)}
                    />
                    <Button size="sm" className="h-8" onClick={() => handleAddComment(s.id)} disabled={!commentText.trim()}>
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout title="Idei & Feedback" description="Contribuie la îmbunătățirea platformei și a institutului">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
            <Lightbulb className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Idei & Feedback</h1>
            <p className="text-sm text-muted-foreground">Contribuie cu idei, sugestii și feedback pentru ICMPP</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total idei', value: stats.total, icon: Lightbulb, color: 'text-amber-600' },
            { label: 'Noi', value: stats.new, icon: Sparkles, color: 'text-blue-600' },
            { label: 'În analiză', value: stats.inReview, icon: Eye, color: 'text-amber-600' },
            { label: 'Implementate', value: stats.implemented, icon: CheckCircle2, color: 'text-green-600' },
          ].map(stat => (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="feed" className="space-y-4">
          <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide">
            <TabsList className="inline-flex md:flex h-11 gap-1 p-1 min-w-max md:min-w-0 bg-muted/50 rounded-xl">
              <TabsTrigger value="feed" className="gap-2 text-sm rounded-lg data-[state=active]:shadow-md">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Feed de idei</span>
              </TabsTrigger>
              <TabsTrigger value="submit" className="gap-2 text-sm rounded-lg data-[state=active]:shadow-md">
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Trimite o idee</span>
              </TabsTrigger>
              <TabsTrigger value="mine" className="gap-2 text-sm rounded-lg data-[state=active]:shadow-md">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Ideile mele ({mySuggestions.length})</span>
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="admin" className="gap-2 text-sm rounded-lg data-[state=active]:shadow-md">
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Administrare</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Feed tab */}
          <TabsContent value="feed" className="space-y-4">
            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Caută idei..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full md:w-44 h-9"><SelectValue placeholder="Categorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate categoriile</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-full md:w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Cele mai noi</SelectItem>
                    <SelectItem value="most_voted">Cele mai votate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <Card className="p-8 text-center">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">Nu s-au găsit idei.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredSuggestions.map(renderCard)}
              </div>
            )}
          </TabsContent>

          {/* Submit tab */}
          <TabsContent value="submit">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Trimite o idee nouă
                </CardTitle>
                <CardDescription>Contribuie la îmbunătățirea ICMPP. Fiecare idee contează!</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label>Titlu *</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Un titlu scurt și descriptiv" required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Categorie</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tip</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prioritate percepută</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Scăzută</SelectItem>
                          <SelectItem value="medium">Medie</SelectItem>
                          <SelectItem value="high">Ridicată</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modul / zona vizată (opțional)</Label>
                      <Input value={targetModule} onChange={e => setTargetModule(e.target.value)} placeholder="Ex: Concedii, Chat, Dashboard" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descriere *</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="Descrie ideea ta în detaliu. Ce problemă rezolvă? Cum ar funcționa?"
                      rows={5} required />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {isAnonymous ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-primary" />}
                      <div>
                        <p className="text-sm font-medium">{isAnonymous ? 'Trimitere anonimă' : 'Trimitere nominală'}</p>
                        <p className="text-xs text-muted-foreground">
                          {isAnonymous ? 'Numele tău nu va fi vizibil' : 'Numele tău va apărea pe sugestie'}
                        </p>
                      </div>
                    </div>
                    <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    {submitting ? 'Se trimite...' : 'Trimite ideea'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My ideas tab */}
          <TabsContent value="mine" className="space-y-3">
            {mySuggestions.length === 0 ? (
              <Card className="p-8 text-center">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground mb-2">Nu ai trimis încă nicio idee.</p>
                <p className="text-xs text-muted-foreground">Mergi la „Trimite o idee" pentru a contribui!</p>
              </Card>
            ) : (
              mySuggestions.map(renderCard)
            )}
          </TabsContent>

          {/* Admin tab */}
          {isSuperAdmin && (
            <TabsContent value="admin" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = suggestions.filter(s => s.status === key).length;
                  return (
                    <Card key={key} className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setFilterStatus(key); }}>
                      <div className="flex items-center gap-2">
                        <cfg.icon className="w-4 h-4" />
                        <div>
                          <p className="text-lg font-bold">{count}</p>
                          <p className="text-xs text-muted-foreground">{cfg.label}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" /> Top idei votate
                </h3>
                {stats.topVoted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nu există idei încă.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topVoted.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground">{s.category}</p>
                        </div>
                        <Badge variant="outline" className="gap-1">
                          <ArrowUp className="w-3 h-3" /> {s.vote_count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Separator />
              <h3 className="font-semibold">Toate ideile</h3>
              <div className="space-y-3">
                {suggestions.map(renderCard)}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
