import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileWarning, ShieldCheck, AlertTriangle, Clock, FileText } from 'lucide-react';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

interface DocEntry {
  employeeName: string;
  department: string | null;
  type: string;
  expiryDate: string | null;
  status: 'valid' | 'expired' | 'expiring' | 'missing';
}

export default function DocumentsExpirationsPanel() {
  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'expired' | 'expiring' | 'valid'>('all');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data: employees } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, department, ci_expiry_date')
      .eq('is_archived', false);

    const today = new Date();
    const thirtyDays = addDays(today, 30);

    const docs: DocEntry[] = [];

    (employees || []).forEach((emp) => {
      const name = `${emp.last_name} ${emp.first_name}`;
      
      // CI expiry
      if (emp.ci_expiry_date) {
        const expiry = new Date(emp.ci_expiry_date);
        let status: DocEntry['status'] = 'valid';
        if (isPast(expiry)) status = 'expired';
        else if (expiry <= thirtyDays) status = 'expiring';
        
        docs.push({ employeeName: name, department: emp.department, type: 'Carte de Identitate', expiryDate: emp.ci_expiry_date, status });
      } else {
        docs.push({ employeeName: name, department: emp.department, type: 'Carte de Identitate', expiryDate: null, status: 'missing' });
      }
    });

    // Sort: expired first, then expiring, then missing, then valid
    const priority = { expired: 0, expiring: 1, missing: 2, valid: 3 };
    docs.sort((a, b) => priority[a.status] - priority[b.status]);

    setEntries(docs);
    setLoading(false);
  };

  const filtered = filter === 'all' ? entries : entries.filter(e => e.status === filter);

  const statusBadge = {
    expired: <Badge variant="destructive" className="text-xs"><FileWarning className="w-3 h-3 mr-1" />Expirat</Badge>,
    expiring: <Badge className="text-xs bg-amber-500 text-white"><AlertTriangle className="w-3 h-3 mr-1" />Expiră curând</Badge>,
    valid: <Badge className="text-xs bg-emerald-500 text-white"><ShieldCheck className="w-3 h-3 mr-1" />Valid</Badge>,
    missing: <Badge variant="secondary" className="text-xs"><Clock className="w-3 h-3 mr-1" />Lipsă</Badge>,
  };

  const counts = {
    expired: entries.filter(e => e.status === 'expired').length,
    expiring: entries.filter(e => e.status === 'expiring').length,
    valid: entries.filter(e => e.status === 'valid').length,
    missing: entries.filter(e => e.status === 'missing').length,
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Expirate', count: counts.expired, color: 'text-destructive', icon: FileWarning },
          { label: 'Expiră Curând', count: counts.expiring, color: 'text-amber-500', icon: AlertTriangle },
          { label: 'Lipsă', count: counts.missing, color: 'text-muted-foreground', icon: Clock },
          { label: 'Valide', count: counts.valid, color: 'text-emerald-500', icon: ShieldCheck },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate ({entries.length})</SelectItem>
            <SelectItem value="expired">Expirate ({counts.expired})</SelectItem>
            <SelectItem value="expiring">Expiră curând ({counts.expiring})</SelectItem>
            <SelectItem value="missing">Lipsă ({counts.missing})</SelectItem>
            <SelectItem value="valid">Valide ({counts.valid})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Documente și Expirări ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Angajat</TableHead>
                  <TableHead>Departament</TableHead>
                  <TableHead>Tip Document</TableHead>
                  <TableHead>Data Expirare</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nu sunt documente în această categorie.</TableCell></TableRow>
                ) : filtered.slice(0, 100).map((doc, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{doc.employeeName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.department || '—'}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>{doc.expiryDate ? format(new Date(doc.expiryDate), 'dd.MM.yyyy') : '—'}</TableCell>
                    <TableCell>{statusBadge[doc.status]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
