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
  remaining_days: number;
  name?: string;
  status?: 'success' | 'not_found' | 'error';
  message?: string;
}

interface LeaveCarryoverImportProps {
  onImported?: () => void;
}

export const LeaveCarryoverImport = ({ onImported }: LeaveCarryoverImportProps) => {
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
          const cnpKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('cnp') || k.toLowerCase() === 'cod numeric personal'
          );
          const daysKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('r\u0103mas') ||
            k.toLowerCase().includes('ramas') ||
            k.toLowerCase().includes('remaining') ||
            k.toLowerCase().includes('zile') ||
            k.toLowerCase().includes('rest') ||
            k.toLowerCase().includes('sold')
          );
          const nameKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('nume') || k.toLowerCase() === 'name'
          );

          if (!cnpKey || !daysKey) continue;

          const cnp = String(row[cnpKey]).trim();
          if (!cnp || cnp.length < 13) continue;

          const days = parseInt(String(row[daysKey]));
          if (isNaN(days) || days < 0) continue;

          parsed.push({
            cnp,
            remaining_days: days,
            name: nameKey ? String(row[nameKey]) : undefined,
          });
        }

        if (parsed.length === 0) {
          toast({
            title: 'Fișier nevalid',
            description: 'Nu s-au găsit coloane cu CNP și zile rămase. Verificați că fișierul conține coloane precum "CNP" și "Zile Rămase".',
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

    const fromYear = 2025;
    const toYear = 2026;
    const results: ImportRow[] = [];

    for (const row of rows) {
      try {
        // Find employee by CNP
        const { data: empData } = await supabase
          .from('employee_personal_data')
          .select('id, first_name, last_name')
          .eq('cnp', row.cnp)
          .eq('is_archived', false)
          .maybeSingle();

        if (!empData) {
          results.push({ ...row, status: 'not_found', message: 'CNP negăsit' });
          continue;
        }

        // Upsert leave_carryover
        const { error } = await supabase
          .from('leave_carryover')
          .upsert({
            employee_personal_data_id: empData.id,
            from_year: fromYear,
            to_year: toYear,
            initial_days: row.remaining_days,
            remaining_days: row.remaining_days,
            used_days: 0,
            created_by: user?.id,
          }, {
            onConflict: 'employee_personal_data_id,from_year,to_year'
          });

        if (error) {
          results.push({ ...row, status: 'error', message: error.message });
        } else {
          results.push({
            ...row,
            status: 'success',
            name: `${empData.last_name} ${empData.first_name}`,
            message: `${row.remaining_days} zile report din ${fromYear}`
          });
        }
      } catch {
        results.push({ ...row, status: 'error', message: 'Eroare necunoscută' });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    if (user && successCount > 0) {
      await supabase.rpc('log_audit_event', {
        _user_id: user.id,
        _action: 'bulk_leave_carryover_import',
        _entity_type: 'leave_carryover',
        _entity_id: null,
        _details: { from_year: fromYear, to_year: toYear, total: rows.length, updated: successCount }
      });
    }

    setRows(results);
    setImported(true);
    setImporting(false);
    onImported?.();
    toast({ title: 'Import finalizat', description: `${successCount} din ${rows.length} angajați actualizați.` });
  };

  const reset = () => {
    setRows([]);
    setImported(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const successCount = rows.filter(r => r.status === 'success').length;
  const errorCount = rows.filter(r => r.status !== 'success' && r.status).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Import Concedii Reportate 2025 → 2026
        </CardTitle>
        <CardDescription>
          Încărcați un fișier Excel cu coloanele <strong>CNP</strong> și <strong>Zile Rămase</strong>.
          Zilele reportate din 2025 se vor adăuga automat la soldul 2026 al fiecărui angajat.
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
            <Button variant="outline" onClick={reset}>Import nou</Button>
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
                  <TableHead>Zile Rămase 2025</TableHead>
                  {imported && <TableHead>Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{row.name || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{row.cnp}</TableCell>
                    <TableCell className="text-sm font-medium">{row.remaining_days}</TableCell>
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
