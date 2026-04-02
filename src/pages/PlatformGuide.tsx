import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import {
  Search, Home, UserCircle, FileText, Calendar, FolderDown, Settings, Shield,
  Users, BookOpen, Bell, HelpCircle, MessageCircle, DoorOpen, PartyPopper,
  ClipboardList, Activity, Archive, Package, Banknote, Megaphone, Headset,
  ChevronRight, ChevronLeft, ArrowRight, ExternalLink, Sparkles, Eye,
  GitBranch, Route, ListChecks, UserCheck, UserPlus, Lock, Clock,
  EyeOff, FileSearch, Rocket, LayoutGrid, Briefcase, User,
  Printer, X,
} from 'lucide-react';
import {
  articles, categories, quickLinks, searchArticles, getArticlesByCategory,
  getArticleById, getRelatedArticles,
  type GuideArticle, type CategoryId,
} from '@/components/guide/guideData';

// ─── Icon Map ───
const iconMap: Record<string, any> = {
  Home, UserCircle, FileText, Calendar, FolderDown, Settings, Shield, Users,
  BookOpen, Bell, HelpCircle, MessageCircle, DoorOpen, PartyPopper, ClipboardList,
  Activity, Archive, Package, Banknote, Megaphone, Headset, Sparkles, Eye,
  GitBranch, Route, ListChecks, UserCheck, UserPlus, Lock, Clock, EyeOff,
  FileSearch, Rocket, LayoutGrid, Briefcase, User, Search,
};
const getIcon = (name: string) => iconMap[name] || HelpCircle;

// ─── Article Renderer ───
function ArticleView({ article, onNavigate }: { article: GuideArticle; onNavigate: (id: string) => void }) {
  const Icon = getIcon(article.iconName);
  const related = getRelatedArticles(article);
  const cat = categories.find(c => c.id === article.category);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={() => onNavigate('')} className="hover:text-primary transition-colors">Ghid</button>
        <ChevronRight className="w-3 h-3" />
        {cat && (
          <>
            <button onClick={() => onNavigate(`cat:${cat.id}`)} className="hover:text-primary transition-colors">{cat.label}</button>
            <ChevronRight className="w-3 h-3" />
          </>
        )}
        <span className="text-foreground font-medium truncate">{article.title}</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">{article.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{article.summary}</p>
          </div>
        </div>
        {article.roles && article.roles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {article.roles.map(r => (
              <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Sections */}
      <div className="space-y-6">
        {article.sections.map((section, i) => (
          <div key={i} className="space-y-2">
            <h3 className="font-semibold text-sm text-foreground">{section.title}</h3>
            {section.paragraphs.map((p, j) => (
              <p key={j} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
            ))}
            {section.steps && (
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground pl-1">
                {section.steps.map((step, k) => <li key={k}>{step}</li>)}
              </ol>
            )}
            {section.tip && (
              <div className="rounded-lg border bg-primary/5 p-3 mt-2">
                <p className="text-xs text-foreground font-medium">💡 Sfat</p>
                <p className="text-xs text-muted-foreground mt-1">{section.tip}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <Separator />
      <div className="flex flex-wrap gap-2">
        {article.moduleLink && (
          <Button asChild size="sm" className="gap-1.5">
            <Link to={article.moduleLink}>
              <ExternalLink className="w-3.5 h-3.5" />
              Deschide modulul
            </Link>
          </Button>
        )}
        {article.irisPrompts && article.irisPrompts.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30">
            <Sparkles className="w-3.5 h-3.5" />
            Întreabă IRIS
          </Button>
        )}
      </div>

      {/* IRIS prompts */}
      {article.irisPrompts && article.irisPrompts.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Întreabă-l pe IRIS despre acest subiect
            </p>
            <div className="flex flex-wrap gap-1.5">
              {article.irisPrompts.map((prompt, i) => (
                <Badge key={i} variant="outline" className="text-[11px] cursor-pointer hover:bg-primary/10 transition-colors">
                  „{prompt}"
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related articles */}
      {related.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Articole similare</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {related.map(rel => {
              const RelIcon = getIcon(rel.iconName);
              return (
                <button
                  key={rel.id}
                  onClick={() => onNavigate(rel.id)}
                  className="flex items-center gap-2.5 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <RelIcon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">{rel.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───
const PlatformGuide = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('article') || '';
  const activeCat = searchParams.get('category') || '';
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role } = useUserRole();

  const navigate = (target: string) => {
    setSearch('');
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!target) {
      setSearchParams({});
    } else if (target.startsWith('cat:')) {
      setSearchParams({ category: target.replace('cat:', '') });
    } else {
      setSearchParams({ article: target });
    }
  };

  const searchResults = useMemo(() => search.trim() ? searchArticles(search) : [], [search]);
  const activeArticle = activeId ? getArticleById(activeId) : null;
  const categoryArticles = activeCat ? getArticlesByCategory(activeCat as CategoryId) : [];
  const activeCatObj = activeCat ? categories.find(c => c.id === activeCat) : null;

  const isHome = !activeArticle && !activeCat;

  return (
    <MainLayout title="Ghid Platformă" description="Centru de ajutor și documentație pentru platforma ICMPP">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ─── Search Bar ─── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Caută în ghid... (ex: concediu, profil, aprobare)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 text-sm"
          />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setSearch('')}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* ─── Search Results ─── */}
        {search.trim() && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-3">
                {searchResults.length} {searchResults.length === 1 ? 'rezultat' : 'rezultate'} pentru „{search}"
              </p>
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nu am găsit articole relevante. Încercați alți termeni sau întrebați IRIS.</p>
              ) : (
                <div className="space-y-1">
                  {searchResults.map(a => {
                    const AIcon = getIcon(a.iconName);
                    return (
                      <button
                        key={a.id}
                        onClick={() => navigate(a.id)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <AIcon className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.summary}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Main Content ─── */}
        {!search.trim() && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">

            {/* ─── Left Sidebar (Desktop) ─── */}
            <aside className="hidden lg:block">
              <Card className="sticky top-24">
                <CardContent className="p-3">
                  <nav className="space-y-1">
                    <button
                      onClick={() => navigate('')}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        isHome ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Home className="w-3.5 h-3.5" />
                      Pagina principală
                    </button>
                    <Separator className="my-2" />
                    {categories.map(cat => {
                      const CatIcon = getIcon(cat.iconName);
                      const isActive = activeCat === cat.id || (activeArticle?.category === cat.id);
                      return (
                        <div key={cat.id}>
                          <button
                            onClick={() => navigate(`cat:${cat.id}`)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                          >
                            <CatIcon className="w-3.5 h-3.5" />
                            {cat.label}
                          </button>
                          {isActive && (
                            <div className="ml-5 mt-1 space-y-0.5">
                              {getArticlesByCategory(cat.id).map(a => (
                                <button
                                  key={a.id}
                                  onClick={() => navigate(a.id)}
                                  className={cn(
                                    "w-full text-left px-2.5 py-1.5 rounded text-[11px] transition-colors truncate",
                                    activeId === a.id ? "text-primary font-semibold bg-primary/5" : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {a.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </nav>
                </CardContent>
              </Card>
            </aside>

            {/* ─── Mobile Category Nav ─── */}
            <div className="lg:hidden flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <Badge
                variant={isHome ? "default" : "outline"}
                className="cursor-pointer shrink-0 text-xs"
                onClick={() => navigate('')}
              >
                Acasă
              </Badge>
              {categories.map(cat => (
                <Badge
                  key={cat.id}
                  variant={activeCat === cat.id || activeArticle?.category === cat.id ? "default" : "outline"}
                  className="cursor-pointer shrink-0 text-xs"
                  onClick={() => navigate(`cat:${cat.id}`)}
                >
                  {cat.label}
                </Badge>
              ))}
            </div>

            {/* ─── Center Content ─── */}
            <div className="min-w-0">

              {/* Article View */}
              {activeArticle && (
                <Card>
                  <CardContent className="p-5 sm:p-6">
                    <ArticleView article={activeArticle} onNavigate={navigate} />
                  </CardContent>
                </Card>
              )}

              {/* Category View */}
              {activeCat && !activeArticle && activeCatObj && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">{activeCatObj.label}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{activeCatObj.description}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categoryArticles.map(a => {
                      const AIcon = getIcon(a.iconName);
                      return (
                        <Card
                          key={a.id}
                          className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
                          onClick={() => navigate(a.id)}
                        >
                          <CardContent className="p-4 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <AIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.summary}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Home View */}
              {isHome && (
                <div className="space-y-8">

                  {/* Hero */}
                  <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-foreground">Centru de Ajutor ICMPP</h1>
                    <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                      Găsiți rapid răspunsuri, instrucțiuni și ghiduri pentru toate funcționalitățile platformei.
                    </p>
                  </div>

                  {/* Quick Links */}
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Rocket className="w-4 h-4 text-primary" />
                      Începe de aici
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {quickLinks.map(ql => (
                        <button
                          key={ql.id}
                          onClick={() => navigate(ql.id)}
                          className="flex items-center gap-2.5 p-3 rounded-lg border hover:bg-muted/50 hover:border-primary/30 transition-all text-left"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs font-medium text-foreground">{ql.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Categories */}
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-primary" />
                      Explorează pe categorii
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categories.map(cat => {
                        const CatIcon = getIcon(cat.iconName);
                        const count = getArticlesByCategory(cat.id).length;
                        return (
                          <Card
                            key={cat.id}
                            className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
                            onClick={() => navigate(`cat:${cat.id}`)}
                          >
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <CatIcon className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{cat.label}</p>
                                <p className="text-xs text-muted-foreground">{count} articole</p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Role Guides */}
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Ghid pe rol
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {getArticlesByCategory('roles').map(a => {
                        const AIcon = getIcon(a.iconName);
                        const isMyRole = a.roles?.includes(role || 'user');
                        return (
                          <Card
                            key={a.id}
                            className={cn(
                              "cursor-pointer hover:shadow-md transition-all duration-200",
                              isMyRole ? "border-primary/40 bg-primary/5" : "hover:border-primary/30"
                            )}
                            onClick={() => navigate(a.id)}
                          >
                            <CardContent className="p-3 text-center space-y-2">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                                <AIcon className="w-4 h-4 text-primary" />
                              </div>
                              <p className="text-xs font-semibold text-foreground">{a.title.replace('Ghid pentru ', '')}</p>
                              {isMyRole && <Badge className="text-[9px]">Rolul tău</Badge>}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Popular Modules */}
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      Module platformă
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {getArticlesByCategory('modules').slice(0, 12).map(a => {
                        const AIcon = getIcon(a.iconName);
                        return (
                          <button
                            key={a.id}
                            onClick={() => navigate(a.id)}
                            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 hover:border-primary/30 transition-all text-left"
                          >
                            <AIcon className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-xs font-medium text-foreground truncate">{a.title}</span>
                          </button>
                        );
                      })}
                      {getArticlesByCategory('modules').length > 12 && (
                        <button
                          onClick={() => navigate('cat:modules')}
                          className="flex items-center gap-2 p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-all text-left"
                        >
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Vezi toate...</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* FAQ */}
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-primary" />
                      Întrebări frecvente
                    </h2>
                    <Accordion type="multiple" className="w-full">
                      {getArticlesByCategory('faq').map(a => (
                        <AccordionItem key={a.id} value={a.id} className="border rounded-lg px-4 mb-2">
                          <AccordionTrigger className="hover:no-underline py-3 text-sm">
                            {a.title}
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                              {a.sections[0]?.paragraphs[0]}
                            </p>
                            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(a.id)}>
                              Citește mai mult →
                            </Button>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>

                  {/* IRIS CTA */}
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-center sm:text-left flex-1">
                        <p className="font-semibold text-sm text-foreground">Nu găsiți ce căutați?</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Întrebați-l pe IRIS, asistentul AI al platformei. Apăsați butonul din colțul din dreapta-jos.</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact */}
                  <Card>
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Headset className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">Contact și Suport</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Pentru probleme tehnice, trimiteți un tichet prin butonul „Contact IT" din meniu sau scrieți-i lui IRIS.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PlatformGuide;
