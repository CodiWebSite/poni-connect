import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, BookOpen, FileText, Users, Building, Edit, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

const CATEGORIES = [
  { value: "concedii", label: "Concedii", icon: Users },
  { value: "adeverinte", label: "Adeverințe", icon: FileText },
  { value: "delegatii", label: "Delegații", icon: Building },
  { value: "proceduri_hr", label: "Proceduri HR", icon: BookOpen },
  { value: "general", label: "General", icon: FileText },
];

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author_id: string | null;
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

const KnowledgeBase = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [viewingArticle, setViewingArticle] = useState<KnowledgeArticle | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
    tags: "",
    is_published: true,
  });

  const canManage = role === "admin" || role === "super_admin" || role === "hr";

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["knowledge-base"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as KnowledgeArticle[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (article: Omit<KnowledgeArticle, "id" | "created_at" | "updated_at" | "view_count">) => {
      const { error } = await supabase.from("knowledge_base").insert(article);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Articol creat", description: "Articolul a fost adăugat cu succes." });
    },
    onError: () => {
      toast({ title: "Eroare", description: "Nu s-a putut crea articolul.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...article }: Partial<KnowledgeArticle> & { id: string }) => {
      const { error } = await supabase.from("knowledge_base").update(article).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setEditingArticle(null);
      resetForm();
      toast({ title: "Articol actualizat", description: "Articolul a fost actualizat cu succes." });
    },
    onError: () => {
      toast({ title: "Eroare", description: "Nu s-a putut actualiza articolul.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast({ title: "Articol șters", description: "Articolul a fost șters cu succes." });
    },
    onError: () => {
      toast({ title: "Eroare", description: "Nu s-a putut șterge articolul.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ title: "", content: "", category: "general", tags: "", is_published: true });
  };

  const handleSubmit = () => {
    const articleData = {
      title: formData.title,
      content: formData.content,
      category: formData.category,
      tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
      is_published: formData.is_published,
      author_id: user?.id || null,
    };

    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, ...articleData });
    } else {
      createMutation.mutate(articleData);
    }
  };

  const handleEdit = (article: KnowledgeArticle) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags.join(", "),
      is_published: article.is_published,
    });
  };

  const filteredArticles = articles.filter((article) => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getCategoryIcon = (category: string) => {
    const CategoryIcon = CATEGORIES.find(c => c.value === category)?.icon || FileText;
    return CategoryIcon;
  };

  return (
    <MainLayout title="Knowledge Base" description="Proceduri HR și documentație internă">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
            <p className="text-muted-foreground">Proceduri HR și documentație internă</p>
          </div>
          
          {canManage && (
            <Dialog open={isCreateDialogOpen || !!editingArticle} onOpenChange={(open) => {
              if (!open) {
                setIsCreateDialogOpen(false);
                setEditingArticle(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Articol nou
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingArticle ? "Editează articol" : "Articol nou"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Titlu</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Titlul articolului"
                    />
                  </div>
                  
                  <div>
                    <Label>Categorie</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Conținut</Label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Conținutul articolului..."
                      className="min-h-[200px]"
                    />
                  </div>
                  
                  <div>
                    <Label>Tag-uri (separate prin virgulă)</Label>
                    <Input
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="concediu, cerere, formular"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_published}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                    />
                    <Label>Publicat</Label>
                  </div>
                  
                  <Button onClick={handleSubmit} className="w-full" disabled={!formData.title || !formData.content}>
                    {editingArticle ? "Actualizează" : "Creează articol"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Caută în articole..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Toate categoriile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate categoriile</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Articles Grid */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Se încarcă...</div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery || selectedCategory !== "all" 
              ? "Nu s-au găsit articole pentru criteriile selectate."
              : "Nu există articole în Knowledge Base."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article) => {
              const CategoryIcon = getCategoryIcon(article.category);
              return (
                <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewingArticle(article)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4 text-primary" />
                        <Badge variant="secondary">{getCategoryLabel(article.category)}</Badge>
                      </div>
                      {!article.is_published && (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{article.content.substring(0, 100)}...</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{format(new Date(article.created_at), "d MMM yyyy", { locale: ro })}</span>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {article.view_count}
                      </div>
                    </div>
                    {article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {article.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* View Article Dialog */}
        <Dialog open={!!viewingArticle} onOpenChange={(open) => !open && setViewingArticle(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {viewingArticle && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{getCategoryLabel(viewingArticle.category)}</Badge>
                    {viewingArticle.tags.map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                  <DialogTitle className="text-xl">{viewingArticle.title}</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Actualizat: {format(new Date(viewingArticle.updated_at), "d MMMM yyyy", { locale: ro })}
                  </p>
                </DialogHeader>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{viewingArticle.content}</p>
                </div>
                {canManage && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => {
                      handleEdit(viewingArticle);
                      setViewingArticle(null);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editează
                    </Button>
                    <Button variant="destructive" onClick={() => {
                      deleteMutation.mutate(viewingArticle.id);
                      setViewingArticle(null);
                    }}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Șterge
                    </Button>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default KnowledgeBase;
