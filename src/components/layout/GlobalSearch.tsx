import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, FileText, Megaphone, Users, Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: 'announcement' | 'document' | 'employee' | 'event';
  url: string;
}

const typeIcons = {
  announcement: Megaphone,
  document: FileText,
  employee: Users,
  event: Calendar
};

const typeLabels = {
  announcement: 'Anunț',
  document: 'Document',
  employee: 'Angajat',
  event: 'Eveniment'
};

export const GlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      const searchResults: SearchResult[] = [];

      // Search announcements
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, title, content')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .limit(3);

      if (announcements) {
        searchResults.push(...announcements.map(a => ({
          id: a.id,
          title: a.title,
          description: a.content.substring(0, 100) + '...',
          type: 'announcement' as const,
          url: '/announcements'
        })));
      }

      // Search documents
      const { data: documents } = await supabase
        .from('documents')
        .select('id, name, description')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(3);

      if (documents) {
        searchResults.push(...documents.map(d => ({
          id: d.id,
          title: d.name,
          description: d.description || undefined,
          type: 'document' as const,
          url: '/documents'
        })));
      }

      // Search employees - use employee_directory view (excludes sensitive phone data)
      const { data: employees } = await supabase
        .from('employee_directory')
        .select('id, full_name, department, position')
        .or(`full_name.ilike.%${query}%,department.ilike.%${query}%,position.ilike.%${query}%`)
        .limit(3) as { data: Array<{ id: string; full_name: string; department: string | null; position: string | null }> | null };

      if (employees) {
        searchResults.push(...employees.map(e => ({
          id: e.id,
          title: e.full_name,
          description: `${e.position || ''} ${e.department ? `• ${e.department}` : ''}`.trim(),
          type: 'employee' as const,
          url: '/employees'
        })));
      }

      // Search events
      const { data: events } = await supabase
        .from('events')
        .select('id, title, description')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(3);

      if (events) {
        searchResults.push(...events.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description || undefined,
          type: 'event' as const,
          url: '/calendar'
        })));
      }

      setResults(searchResults);
      setLoading(false);
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url);
    setQuery('');
    setShowResults(false);
    setMobileOpen(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const SearchResultsList = () => (
    <>
      {loading ? (
        <div className="p-4 text-center text-muted-foreground">
          Căutare...
        </div>
      ) : results.length === 0 && query.length >= 2 ? (
        <div className="p-4 text-center text-muted-foreground">
          Nu s-au găsit rezultate pentru "{query}"
        </div>
      ) : results.length > 0 ? (
        <div className="py-2">
          {results.map((result) => {
            const Icon = typeIcons[result.type];
            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  result.type === 'announcement' && "bg-primary/10 text-primary",
                  result.type === 'document' && "bg-accent/10 text-accent",
                  result.type === 'employee' && "bg-info/10 text-info",
                  result.type === 'event' && "bg-success/10 text-success"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{result.title}</p>
                  {result.description && (
                    <p className="text-sm text-muted-foreground truncate">{result.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {typeLabels[result.type]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );

  return (
    <>
      {/* Desktop Search */}
      <div ref={wrapperRef} className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Caută anunțuri, documente, angajați..."
          className="pl-10 pr-8 w-72 bg-secondary/50"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {showResults && query.length >= 2 && (
          <div className="absolute top-full mt-2 w-96 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            <SearchResultsList />
          </div>
        )}
      </div>

      {/* Mobile Search Button + Dialog */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Search className="w-5 h-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Căutare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Caută..."
                className="pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              <SearchResultsList />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
