import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { 
  Lightbulb, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Trash2,
  Reply
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  admin_response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
  responder?: { full_name: string } | null;
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'functionalitate', label: 'Funcționalitate nouă' },
  { value: 'imbunatatire', label: 'Îmbunătățire existentă' },
  { value: 'bug', label: 'Problemă / Bug' },
  { value: 'design', label: 'Design / UI' },
  { value: 'altele', label: 'Altele' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  pending: { label: 'În așteptare', variant: 'secondary', icon: Clock },
  reviewed: { label: 'Analizat', variant: 'default', icon: CheckCircle },
  implemented: { label: 'Implementat', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Respins', variant: 'destructive', icon: XCircle },
};

export default function Suggestions() {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isDirector } = useUserRole();
  const { toast } = useToast();
  
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('reviewed');

  const canManageSuggestions = isAdmin || isSuperAdmin || isDirector;

  useEffect(() => {
    fetchSuggestions();
  }, [user]);

  const fetchSuggestions = async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch suggestions - RLS will handle filtering
    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching suggestions:', error);
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca sugestiile.', variant: 'destructive' });
    } else if (data) {
      // Fetch profile names for each suggestion
      const userIds = [...new Set(data.map(s => s.user_id))];
      const responderIds = [...new Set(data.filter(s => s.responded_by).map(s => s.responded_by!))];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', [...userIds, ...responderIds]);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      
      const enrichedData = data.map(s => ({
        ...s,
        profiles: { full_name: profileMap.get(s.user_id) || 'Necunoscut' },
        responder: s.responded_by ? { full_name: profileMap.get(s.responded_by) || 'Necunoscut' } : null
      }));
      
      setSuggestions(enrichedData);
    }
    
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !description.trim()) return;
    
    setSubmitting(true);
    
    const { error } = await supabase
      .from('suggestions')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category
      });
    
    if (error) {
      console.error('Error submitting suggestion:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut trimite sugestia.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Sugestia a fost trimisă!' });
      setTitle('');
      setDescription('');
      setCategory('general');
      fetchSuggestions();
    }
    
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('suggestions')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge sugestia.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Sugestia a fost ștearsă.' });
      fetchSuggestions();
    }
  };

  const handleRespond = async (id: string) => {
    if (!responseText.trim()) return;
    
    const { error } = await supabase
      .from('suggestions')
      .update({
        status: responseStatus,
        admin_response: responseText.trim(),
        responded_by: user?.id,
        responded_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut trimite răspunsul.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Răspunsul a fost trimis.' });
      setRespondingTo(null);
      setResponseText('');
      setResponseStatus('reviewed');
      fetchSuggestions();
    }
  };

  const mySuggestions = suggestions.filter(s => s.user_id === user?.id);
  const allSuggestions = suggestions;

  const renderSuggestionCard = (suggestion: Suggestion, showAuthor: boolean = false) => {
    const statusConfig = STATUS_CONFIG[suggestion.status] || STATUS_CONFIG.pending;
    const StatusIcon = statusConfig.icon;
    const canDelete = suggestion.user_id === user?.id && suggestion.status === 'pending';
    const canRespond = canManageSuggestions && suggestion.status === 'pending';
    
    return (
      <Card key={suggestion.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">{suggestion.title}</CardTitle>
              <CardDescription className="mt-1">
                {showAuthor && <span className="font-medium">{suggestion.profiles?.full_name} • </span>}
                {format(new Date(suggestion.created_at), 'dd MMMM yyyy, HH:mm', { locale: ro })}
                <Badge variant="outline" className="ml-2">
                  {CATEGORIES.find(c => c.value === suggestion.category)?.label || suggestion.category}
                </Badge>
              </CardDescription>
            </div>
            <Badge variant={statusConfig.variant} className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground whitespace-pre-wrap">{suggestion.description}</p>
          
          {suggestion.admin_response && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">Răspuns de la {suggestion.responder?.full_name}</span>
                {suggestion.responded_at && (
                  <span className="text-xs text-muted-foreground">
                    • {format(new Date(suggestion.responded_at), 'dd MMM yyyy', { locale: ro })}
                  </span>
                )}
              </div>
              <p className="text-sm">{suggestion.admin_response}</p>
            </div>
          )}
          
          {respondingTo === suggestion.id && (
            <div className="mt-4 p-4 border rounded-lg space-y-3">
              <div className="space-y-2">
                <Label>Status nou</Label>
                <Select value={responseStatus} onValueChange={setResponseStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewed">Analizat</SelectItem>
                    <SelectItem value="implemented">Implementat</SelectItem>
                    <SelectItem value="rejected">Respins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Răspuns</Label>
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Scrie un răspuns pentru această sugestie..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleRespond(suggestion.id)}>
                  Trimite răspuns
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRespondingTo(null)}>
                  Anulează
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex gap-2 mt-4">
            {canRespond && respondingTo !== suggestion.id && (
              <Button size="sm" variant="outline" onClick={() => setRespondingTo(suggestion.id)}>
                <Reply className="w-4 h-4 mr-1" />
                Răspunde
              </Button>
            )}
            {canDelete && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleDelete(suggestion.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Șterge
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout title="Sugestii pentru Intranet" description="Trimite-ne ideile tale pentru a îmbunătăți platforma">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Sugestii pentru Intranet</h1>
            <p className="text-muted-foreground">Trimite-ne ideile tale pentru a îmbunătăți platforma</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form for new suggestion */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Sugestie nouă
              </CardTitle>
              <CardDescription>
                Ce ai vrea să vezi pe intranet?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titlu</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titlul sugestiei"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Categorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Descriere</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrie sugestia ta în detaliu..."
                    rows={5}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Se trimite...' : 'Trimite sugestia'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Suggestions list */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="my" className="w-full">
              <TabsList>
                <TabsTrigger value="my">Sugestiile mele ({mySuggestions.length})</TabsTrigger>
                {canManageSuggestions && (
                  <TabsTrigger value="all">Toate sugestiile ({allSuggestions.length})</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="my" className="mt-4">
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">Se încarcă...</p>
                ) : mySuggestions.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nu ai trimis încă nicio sugestie.</p>
                      <p className="text-sm">Folosește formularul din stânga pentru a trimite prima ta idee!</p>
                    </CardContent>
                  </Card>
                ) : (
                  mySuggestions.map(s => renderSuggestionCard(s, false))
                )}
              </TabsContent>
              
              {canManageSuggestions && (
                <TabsContent value="all" className="mt-4">
                  {loading ? (
                    <p className="text-muted-foreground text-center py-8">Se încarcă...</p>
                  ) : allSuggestions.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nu există sugestii încă.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    allSuggestions.map(s => renderSuggestionCard(s, true))
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
