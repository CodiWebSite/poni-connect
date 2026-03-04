import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, Play, CheckCircle, XCircle, AlertTriangle, Loader2, Mail } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MatchResult {
  csv_email: string;
  csv_last_name: string;
  csv_first_name: string;
  epd_id: string | null;
  epd_email: string | null;
  epd_last_name: string | null;
  epd_first_name: string | null;
  match_type: string;
  action: string;
  details: string;
}

interface SyncSummary {
  total_csv_rows: number;
  total_epd_active: number;
  matched_by_email: number;
  matched_by_name: number;
  emails_to_update: number;
  not_found: number;
  no_change: number;
  dry_run: boolean;
  applied_updates: number;
}

export function EmailSyncImport() {
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [filter, setFilter] = useState<'all' | 'update_email' | 'not_found' | 'no_change'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSummary(null);
    setResults([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvContent(ev.target?.result as string);
    };
    reader.readAsText(file, 'utf-8');
  };

  const runSync = async (dryRun: boolean) => {
    if (!csvContent) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('sync-employee-emails', {
        body: { csv: csvContent, dry_run: dryRun },
      });

      if (error) throw error;

      setSummary(data.summary);
      setResults(data.results || []);

      if (!dryRun && data.summary.applied_updates > 0) {
        toast({
          title: 'Emailuri actualizate',
          description: `${data.summary.applied_updates} emailuri au fost actualizate cu succes.`,
        });
      }
    } catch (err: any) {
      toast({
        title: 'Eroare',
        description: err.message || 'Eroare la sincronizare',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = results.filter((r) => {
    if (filter === 'all') return true;
    return r.action === filter;
  });

  const actionBadge = (action: string) => {
    switch (action) {
      case 'no_change':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" /> OK</Badge>;
      case 'update_email':
        return <Badge className="gap-1 bg-amber-500"><Mail className="h-3 w-3" /> Actualizare</Badge>;
      case 'not_found':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Negăsit</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Sincronizare Emailuri Angajați
        </CardTitle>
        <CardDescription>
          Importă lista de emailuri din CSV și actualizează adresele în baza de date.
          Prima rulare este în modul previzualizare (fără modificări).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File upload */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {fileName || 'Selectează CSV'}
          </Button>

          {csvContent && (
            <>
              <Button
                onClick={() => runSync(true)}
                disabled={loading}
                variant="secondary"
                className="gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                Previzualizare (dry-run)
              </Button>

              {summary && summary.dry_run && summary.emails_to_update > 0 && (
                <Button
                  onClick={() => runSync(false)}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Aplică {summary.emails_to_update} actualizări
                </Button>
              )}
            </>
          )}
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Total CSV</div>
              <div className="text-2xl font-bold">{summary.total_csv_rows}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Potriviți (email)</div>
              <div className="text-2xl font-bold text-green-600">{summary.matched_by_email}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Potriviți (nume)</div>
              <div className="text-2xl font-bold text-blue-600">{summary.matched_by_name}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">De actualizat</div>
              <div className="text-2xl font-bold text-amber-600">{summary.emails_to_update}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Fără schimbare</div>
              <div className="text-2xl font-bold">{summary.no_change}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Negăsiți</div>
              <div className="text-2xl font-bold text-red-600">{summary.not_found}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Total EPD activi</div>
              <div className="text-2xl font-bold">{summary.total_epd_active}</div>
            </Card>
            {!summary.dry_run && (
              <Card className="p-3">
                <div className="text-sm text-muted-foreground">Aplicat</div>
                <div className="text-2xl font-bold text-green-600">{summary.applied_updates}</div>
              </Card>
            )}
          </div>
        )}

        {/* Filter buttons */}
        {results.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
              Toate ({results.length})
            </Button>
            <Button size="sm" variant={filter === 'update_email' ? 'default' : 'outline'} onClick={() => setFilter('update_email')}>
              De actualizat ({results.filter(r => r.action === 'update_email').length})
            </Button>
            <Button size="sm" variant={filter === 'not_found' ? 'default' : 'outline'} onClick={() => setFilter('not_found')}>
              Negăsiți ({results.filter(r => r.action === 'not_found').length})
            </Button>
            <Button size="sm" variant={filter === 'no_change' ? 'default' : 'outline'} onClick={() => setFilter('no_change')}>
              OK ({results.filter(r => r.action === 'no_change').length})
            </Button>
          </div>
        )}

        {/* Results table */}
        {filteredResults.length > 0 && (
          <ScrollArea className="h-[400px] rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email CSV</TableHead>
                  <TableHead>Nume CSV</TableHead>
                  <TableHead>Email EPD</TableHead>
                  <TableHead>Nume EPD</TableHead>
                  <TableHead>Potrivire</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detalii</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((r, i) => (
                  <TableRow key={i} className={r.action === 'update_email' ? 'bg-amber-50 dark:bg-amber-950/20' : r.action === 'not_found' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                    <TableCell className="font-mono text-xs">{r.csv_email}</TableCell>
                    <TableCell className="text-sm">{r.csv_last_name} {r.csv_first_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.epd_email || '—'}</TableCell>
                    <TableCell className="text-sm">{r.epd_last_name ? `${r.epd_last_name} ${r.epd_first_name}` : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.match_type}</Badge>
                    </TableCell>
                    <TableCell>{actionBadge(r.action)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">{r.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
