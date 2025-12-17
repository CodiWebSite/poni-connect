import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Archive, Search, Filter, FileDown, FileUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ArchivedDocument {
  id: string;
  registration_number: string;
  direction: 'incoming' | 'outgoing';
  document_date: string;
  sender: string | null;
  recipient: string | null;
  subject: string;
  category: string | null;
  resolved_at: string | null;
  created_at: string;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const categories = [
  'Corespondență oficială',
  'Contracte',
  'Facturi',
  'Cereri',
  'Rapoarte',
  'Altele'
];

const DigitalArchive = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDirection, setFilterDirection] = useState<string>('all');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['archive-documents', filterYear],
    queryFn: async () => {
      const startDate = `${filterYear}-01-01`;
      const endDate = `${filterYear}-12-31`;
      
      const { data, error } = await supabase
        .from('document_registry')
        .select('*')
        .gte('document_date', startDate)
        .lte('document_date', endDate)
        .not('resolved_at', 'is', null)
        .order('document_date', { ascending: false });
      
      if (error) throw error;
      return data as ArchivedDocument[];
    }
  });

  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = doc.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.registration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.sender?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.recipient?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    const matchesDirection = filterDirection === 'all' || doc.direction === filterDirection;

    return matchesSearch && matchesCategory && matchesDirection;
  });

  const stats = {
    total: documents?.length || 0,
    incoming: documents?.filter(d => d.direction === 'incoming').length || 0,
    outgoing: documents?.filter(d => d.direction === 'outgoing').length || 0
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Documente {filterYear}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Archive className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documente Intrare</p>
                <p className="text-2xl font-bold text-primary">{stats.incoming}</p>
              </div>
              <FileDown className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documente Ieșire</p>
                <p className="text-2xl font-bold text-secondary">{stats.outgoing}</p>
              </div>
              <FileUp className="h-8 w-8 text-secondary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Archive Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Arhivă Digitală
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Caută în arhivă..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDirection} onValueChange={setFilterDirection}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate</SelectItem>
                <SelectItem value="incoming">Intrări</SelectItem>
                <SelectItem value="outgoing">Ieșiri</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate categoriile</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr. Înreg.</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Expeditor/Destinatar</TableHead>
                    <TableHead>Subiect</TableHead>
                    <TableHead>Categorie</TableHead>
                    <TableHead>Rezolvat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nu s-au găsit documente în arhivă pentru criteriile selectate
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocuments?.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-mono font-medium">
                          {doc.registration_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant={doc.direction === 'incoming' ? 'default' : 'secondary'}>
                            {doc.direction === 'incoming' ? (
                              <><FileDown className="h-3 w-3 mr-1" />Intrare</>
                            ) : (
                              <><FileUp className="h-3 w-3 mr-1" />Ieșire</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(doc.document_date), 'dd MMM yyyy', { locale: ro })}
                        </TableCell>
                        <TableCell>
                          {doc.direction === 'incoming' ? doc.sender : doc.recipient}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {doc.subject}
                        </TableCell>
                        <TableCell>
                          {doc.category ? (
                            <Badge variant="outline">{doc.category}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {doc.resolved_at && format(new Date(doc.resolved_at), 'dd.MM.yyyy', { locale: ro })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Results count */}
          {filteredDocuments && filteredDocuments.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {filteredDocuments.length} document(e) găsite
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DigitalArchive;
