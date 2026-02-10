import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Upload, Loader2, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ImportRow {
  cnp: string;
  ci_expiry_date: string;
  name?: string;
  status?: 'success' | 'not_found' | 'error';
  message?: string;
}

export const CIExpiryImport = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const parsed: ImportRow[] = [];
        for (const row of json) {
          // Find CNP column (flexible matching)
          const cnpKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('cnp') || k.toLowerCase() === 'cod numeric personal'
          );
          // Find expiry date column
          const expiryKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('expir') || 
            k.toLowerCase().includes('valabil') ||
            k.toLowerCase().includes('data_expirare') ||
            k.toLowerCase().includes('ci_expiry')
          );
          // Find name column (optional)
          const nameKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('nume') || k.toLowerCase() === 'name'
          );

          if (!cnpKey || !expiryKey) continue;

          const cnp = String(row[cnpKey]).trim();
          if (!cnp || cnp.length < 13) continue;

          let expiryDate = '';
          const rawDate = row[expiryKey];
          
          if (rawDate instanceof Date) {
            expiryDate = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            // Excel serial date
            const d = XLSX.SSF.parse_date_code(rawDate);
            if (d) expiryDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else {
            const str = String(rawDate).trim();
            // Try dd.MM.yyyy or dd/MM/yyyy
            const match = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
            if (match) {
              expiryDate = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
            } else {
              // Try yyyy-MM-dd
              const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              if (isoMatch) expiryDate = str;
            }
          }

          if (!expiryDate) continue;

          parsed.push({
            cnp,
            ci_expiry_date: expiryDate,
            name: nameKey ? String(row[nameKey]) : undefined,
          });
        }

        if (parsed.length === 0) {
          toast({
            title: 'Fișier nevalid',
            description: 'Nu s-au găsit coloane cu CNP și data expirare CI. Verificați că fișierul conține coloane precum "CNP" și "Data Expirare".',
            variant: 'destructive',
          });
          return;
        }

        setRows(parsed);
        setImported(false);
        toast({ title: `${parsed.length} rânduri detectate`, description: 'Verificați datele și apoi apăsați Import.' });
      } catch (err) {
        console.error('Parse error:', err);
        toast({ title: 'Eroare', description: 'Nu s-a putut citi fișierul.', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);

    const results: ImportRow[] = [];
    
    for (const row of rows) {
      try {
        const { data, error } = await supabase
          .from('employee_personal_data')
          .update({ ci_expiry_date: row.ci_expiry_date } as any)
          .eq('cnp', row.cnp)
          .eq('is_archived', false)
          .select('id, first_name, last_name');

        if (error) {
          results.push({ ...row, status: 'error', message: error.message });
        } else if (!data || data.length === 0) {
          results.push({ ...row, status: 'not_found', message: 'CNP negăsit în baza de date' });
        } else {
          const emp = data[0];
          results.push({ 
            ...row, 
            status: 'success', 
            name: `${emp.last_name} ${emp.first_name}`,
            message: `Actualizat: ${row.ci_expiry_date}` 
          });
        }
      } catch (err) {
        results.push({ ...row, status: 'error', message: 'Eroare necunoscută' });
      }
    }

    // Audit log
    const successCount = results.filter(r => r.status === 'success').length;
    if (user && successCount > 0) {
      await supabase.rpc('log_audit_event', {
        _user_id: user.id,
        _action: 'bulk_ci_expiry_import',
        _entity_type: 'employee_personal_data',
        _entity_id: null,
        _details: { total: rows.length, updated: successCount }
      });
    }

    setRows(results);
    setImported(true);
    setImporting(false);
    toast({ 
      title: 'Import finalizat', 
      description: `${successCount} din ${rows.length} angajați actualizați.` 
    });
  };

  const reset = () => {
    setRows([]);
    setImported(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const successCount = rows.filter(r => r.status === 'success').length;
  const errorCount = rows.filter(r => r.status === 'not_found' || r.status === 'error').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Import Date Expirare CI
        </CardTitle>
        <CardDescription>
          Încărcați un fișier Excel sau CSV cu coloanele <strong>CNP</strong> și <strong>Data Expirare</strong> (format: ZZ.LL.AAAA). 
          Sistemul va actualiza automat data expirării CI pentru toți angajații găsiți după CNP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          {rows.length > 0 && !imported && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Importă {rows.length} înregistrări
            </Button>
          )}
          {imported && (
            <Button variant="outline" onClick={reset}>
              Import nou
            </Button>
          )}
        </div>

        {imported && (
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" /> {successCount} actualizați
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="w-4 h-4" /> {errorCount} erori
              </span>
            )}
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-[400px] overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>CNP</TableHead>
                  <TableHead>Data Expirare CI</TableHead>
                  {imported && <TableHead>Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{row.name || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{row.cnp}</TableCell>
                    <TableCell className="text-sm">{row.ci_expiry_date}</TableCell>
                    {imported && (
                      <TableCell>
                        {row.status === 'success' && (
                          <span className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle className="w-3 h-3" /> {row.message}
                          </span>
                        )}
                        {row.status === 'not_found' && (
                          <span className="flex items-center gap-1 text-amber-600 text-xs">
                            <XCircle className="w-3 h-3" /> {row.message}
                          </span>
                        )}
                        {row.status === 'error' && (
                          <span className="flex items-center gap-1 text-destructive text-xs">
                            <XCircle className="w-3 h-3" /> {row.message}
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
