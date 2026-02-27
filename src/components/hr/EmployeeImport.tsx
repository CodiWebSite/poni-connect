import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle, Users, Mail, Eye, Filter } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ParsedEmployee,
  parseEmployeeWorkbook,
  parseEmailFile,
  parseEmailCsv,
  matchEmails,
} from '@/utils/parseEmployeeXls';

type Step = 'upload-xls' | 'upload-emails' | 'preview' | 'done';

interface ImportResult {
  success: boolean;
  imported?: number;
  skipped?: number;
  total?: number;
  message?: string;
  errors?: string[];
  error?: string;
}

export const EmployeeImport = () => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload-xls');
  const [employees, setEmployees] = useState<ParsedEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [xlsFileName, setXlsFileName] = useState('');
  const [emailFileName, setEmailFileName] = useState('');

  // Get unique departments
  const departments = useMemo(() => {
    const depts = [...new Set(employees.map(e => e.department))];
    return depts.sort();
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (departmentFilter === 'all') return employees;
    return employees.filter(e => e.department === departmentFilter);
  }, [employees, departmentFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: employees.length,
    withEmail: employees.filter(e => e.email).length,
    withoutEmail: employees.filter(e => !e.email).length,
    departments: departments.length,
  }), [employees, departments]);

  const handleXlsUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setXlsFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const parsed = parseEmployeeWorkbook(workbook);

        if (parsed.length === 0) {
          toast({
            title: 'Eroare parsare',
            description: 'Nu am găsit angajați în fișierul XLS. Verificați structura fișierului.',
            variant: 'destructive',
          });
          return;
        }

        setEmployees(parsed);
        setStep('upload-emails');
        toast({
          title: 'Fișier XLS parsat',
          description: `${parsed.length} angajați din ${new Set(parsed.map(e => e.department)).size} departamente.`,
        });
      } catch (err) {
        console.error('XLS parse error:', err);
        toast({
          title: 'Eroare la citirea fișierului',
          description: 'Fișierul XLS nu a putut fi citit. Verificați formatul.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleEmailUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setEmailFileName(file.name);
    const reader = new FileReader();

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const emailEntries = parseEmailCsv(content);
          const matched = matchEmails(employees, emailEntries);
          setEmployees(matched);
          const matchedCount = matched.filter(e => e.emailMatched).length;
          setStep('preview');
          toast({
            title: 'Emailuri potrivite',
            description: `${matchedCount} din ${matched.length} angajați au fost potriviți cu emailuri.`,
          });
        } catch (err) {
          console.error('CSV parse error:', err);
          toast({ title: 'Eroare', description: 'Nu am putut citi fișierul CSV.', variant: 'destructive' });
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const emailEntries = parseEmailFile(workbook);
          const matched = matchEmails(employees, emailEntries);
          setEmployees(matched);
          const matchedCount = matched.filter(e => e.emailMatched).length;
          setStep('preview');
          toast({
            title: 'Emailuri potrivite',
            description: `${matchedCount} din ${matched.length} angajați au fost potriviți cu emailuri.`,
          });
        } catch (err) {
          console.error('Email file parse error:', err);
          toast({ title: 'Eroare', description: 'Nu am putut citi fișierul de emailuri.', variant: 'destructive' });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleEmailChange = (index: number, email: string) => {
    setEmployees(prev => {
      const updated = [...prev];
      const globalIndex = departmentFilter === 'all'
        ? index
        : prev.findIndex(e => e === filteredEmployees[index]);
      updated[globalIndex] = { ...updated[globalIndex], email: email.toLowerCase().trim(), emailMatched: false };
      return updated;
    });
  };

  const handleImport = async () => {
    const employeesWithEmail = employees.filter(e => e.email);

    if (employeesWithEmail.length === 0) {
      toast({
        title: 'Eroare',
        description: 'Niciun angajat nu are email setat. Completați emailurile înainte de import.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload = employeesWithEmail.map(emp => ({
        email: emp.email,
        first_name: emp.firstName,
        last_name: emp.lastName,
        cnp: emp.cnp,
        department: emp.department,
        position: emp.position,
        grade: emp.grade || null,
        contract_type: 'nedeterminat',
        total_leave_days: emp.totalLeaveDays,
        used_leave_days: emp.usedLeaveDays,
        employment_date: new Date().toISOString().split('T')[0],
        // CI fields from email file
        ci_series: emp.ci_series || null,
        ci_number: emp.ci_number || null,
        ci_issued_by: emp.ci_issued_by || null,
        ci_issued_date: emp.ci_issued_date || null,
        // Address fields from email file
        address_street: emp.address_street || null,
        address_number: emp.address_number || null,
        address_block: emp.address_block || null,
        address_floor: emp.address_floor || null,
        address_apartment: emp.address_apartment || null,
        address_city: emp.address_city || null,
        address_county: emp.address_county || null,
      }));

      const { data, error } = await supabase.functions.invoke('import-employees', {
        body: { employees: payload },
      });

      if (error) throw error;

      setResult(data);
      if (data.success) {
        setStep('done');
        toast({
          title: 'Import reușit',
          description: data.message || `Importați ${data.imported} angajați.`,
        });
      } else {
        toast({
          title: 'Eroare la import',
          description: data.error || 'A apărut o eroare.',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
      setResult({ success: false, error: errorMessage });
      toast({ title: 'Eroare la import', description: errorMessage, variant: 'destructive' });
    }

    setLoading(false);
  };

  const handleReset = () => {
    setStep('upload-xls');
    setEmployees([]);
    setResult(null);
    setXlsFileName('');
    setEmailFileName('');
    setDepartmentFilter('all');
  };

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === 'upload-xls' ? 'default' : 'secondary'} className="gap-1">
          <FileSpreadsheet className="h-3 w-3" /> 1. XLS Angajați
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant={step === 'upload-emails' ? 'default' : 'secondary'} className="gap-1">
          <Mail className="h-3 w-3" /> 2. Fișier Emailuri
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant={step === 'preview' ? 'default' : 'secondary'} className="gap-1">
          <Eye className="h-3 w-3" /> 3. Previzualizare
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant={step === 'done' ? 'default' : 'secondary'} className="gap-1">
          <CheckCircle className="h-3 w-3" /> 4. Import
        </Badge>
      </div>

      {/* Step 1: Upload XLS */}
      {step === 'upload-xls' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Pasul 1: Încărcați fișierul XLS cu angajați
            </CardTitle>
            <CardDescription>
              Fișierul XLS cu toate departamentele (Lab1, Lab2, SRUS etc.). Fiecare sheet = un departament.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="xls-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Click pentru a încărca</span> fișierul XLS/XLSX
                </p>
                <p className="text-xs text-muted-foreground">Format: .xls sau .xlsx</p>
              </div>
              <input
                id="xls-upload"
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={handleXlsUpload}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload email file */}
      {step === 'upload-emails' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pasul 2: Încărcați fișierul cu emailuri
            </CardTitle>
            <CardDescription>
              Fișier XLS/CSV cu 2 coloane: Nume și Email. Potrivirea se face automat după nume.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Users className="h-4 w-4" />
              <AlertTitle>{stats.total} angajați parsați</AlertTitle>
              <AlertDescription>
                Din {stats.departments} departamente. Acum încărcați fișierul cu emailuri pentru a le potrivi.
              </AlertDescription>
            </Alert>

            <label
              htmlFor="email-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Click pentru a încărca</span> fișierul cu emailuri
                </p>
                <p className="text-xs text-muted-foreground">Format: .xls, .xlsx sau .csv (separator ;)</p>
              </div>
              <input
                id="email-upload"
                type="file"
                accept=".xls,.xlsx,.csv,.txt"
                className="hidden"
                onChange={handleEmailUpload}
              />
            </label>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('preview')}>
                Sari peste → Mergi la previzualizare
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Resetează
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {(step === 'preview' || step === 'done') && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Previzualizare Import
                </CardTitle>
                <CardDescription>
                  {xlsFileName && <span className="mr-2">📊 {xlsFileName}</span>}
                  {emailFileName && <span>📧 {emailFileName}</span>}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 font-medium">{stats.withEmail} cu email</span>
                <span className="text-red-500 font-medium">{stats.withoutEmail} fără email</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Department filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Toate departamentele" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate departamentele ({stats.total})</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept} ({employees.filter(e => e.department === dept).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee table */}
            <div className="border rounded-lg max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]">#</TableHead>
                    <TableHead>Departament</TableHead>
                    <TableHead>Nume complet</TableHead>
                    <TableHead>CNP</TableHead>
                    <TableHead>Funcție</TableHead>
                    <TableHead>Grad</TableHead>
                    <TableHead className="w-[250px]">Email</TableHead>
                    <TableHead className="text-center">Zile CO</TableHead>
                    <TableHead className="text-center">Folosite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp, i) => (
                    <TableRow key={`${emp.cnp}-${i}`} className={!emp.email ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate" title={emp.department}>
                        {emp.department}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{emp.fullName}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.cnp}</TableCell>
                      <TableCell className="text-xs">{emp.position || '-'}</TableCell>
                      <TableCell className="text-xs">{emp.grade || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={emp.email}
                            onChange={(e) => handleEmailChange(i, e.target.value)}
                            placeholder="email@icmpp.ro"
                            className={`h-7 text-xs ${emp.emailMatched ? 'border-green-400' : emp.email ? 'border-blue-400' : 'border-red-300'}`}
                            disabled={step === 'done'}
                          />
                          {emp.emailMatched && <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{emp.totalLeaveDays}</TableCell>
                      <TableCell className="text-center text-sm">{emp.usedLeaveDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Result */}
            {result && (
              <Alert variant={result.success ? 'default' : 'destructive'}>
                {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertTitle>{result.success ? 'Import finalizat' : 'Eroare'}</AlertTitle>
                <AlertDescription>
                  {result.success ? (
                    <div>
                      <p>Importați: {result.imported} din {result.total}</p>
                      {result.skipped && result.skipped > 0 && <p>Omise: {result.skipped}</p>}
                      {result.errors && result.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium">Erori:</p>
                          <ul className="list-disc list-inside text-xs">
                            {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p>{result.error}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {step !== 'done' && (
                <Button onClick={handleImport} disabled={loading || stats.withEmail === 0} className="flex-1">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Se importă...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Importă {stats.withEmail} angajați</>
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={handleReset}>
                {step === 'done' ? 'Import Nou' : 'Resetează'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
