import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Download, Loader2 } from 'lucide-react';
import { differenceInYears, differenceInMonths, parseISO, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { generateCertificateDocx, CertificateType } from '@/utils/generateCertificate';

interface Employee {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  cnp: string;
  department: string | null;
  position: string | null;
  grade: string | null;
  employment_date: string;
  contract_type: string | null;
  total_leave_days: number;
  used_leave_days: number;
  email: string;
}

interface CertificateGeneratorProps {
  employees: Employee[];
}

const certificateTypes: { value: CertificateType; label: string; description: string }[] = [
  { value: 'salariat', label: 'Adeverință de salariat', description: 'Confirmă calitatea de angajat al instituției' },
  { value: 'venit', label: 'Adeverință de venit', description: 'Confirmă încadrarea și locul de muncă (pentru bănci, instituții)' },
  { value: 'vechime', label: 'Adeverință de vechime', description: 'Detaliază vechimea în muncă la instituție' },
];

const CertificateGenerator = ({ employees }: CertificateGeneratorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedType, setSelectedType] = useState<CertificateType>('salariat');
  const [purpose, setPurpose] = useState('');
  const [generating, setGenerating] = useState(false);

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerate = async () => {
    if (!selectedEmployee) return;
    setGenerating(true);
    try {
      await generateCertificateDocx(selectedEmployee, selectedType, purpose);
    } catch (err) {
      console.error('Certificate generation error:', err);
    }
    setGenerating(false);
  };

  const getSeniority = (emp: Employee) => {
    if (!emp.employment_date) return '-';
    const now = new Date();
    const start = parseISO(emp.employment_date);
    const years = differenceInYears(now, start);
    const months = differenceInMonths(now, start) % 12;
    return `${years} ani, ${months} luni`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee selection */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4" />
              Selectează angajat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Caută angajat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {filteredEmployees.slice(0, 50).map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className={`w-full text-left p-2.5 rounded-md text-sm transition-colors ${
                    selectedEmployee?.id === emp.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <p className="font-medium truncate">{emp.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {emp.department || 'Fără dept.'} • {emp.position || 'Fără funcție'}
                  </p>
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Niciun angajat găsit</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Certificate configuration */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Generare adeverință
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedEmployee ? (
              <>
                {/* Employee info summary */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{selectedEmployee.full_name}</h3>
                    <Badge variant="outline">{selectedEmployee.contract_type === 'determinat' ? 'CIM Determinat' : 'CIM Nedeterminat'}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Departament: </span>
                      <span className="font-medium">{selectedEmployee.department || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Funcție: </span>
                      <span className="font-medium">{selectedEmployee.position || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Grad: </span>
                      <span className="font-medium">{selectedEmployee.grade || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vechime: </span>
                      <span className="font-medium">{getSeniority(selectedEmployee)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data angajării: </span>
                      <span className="font-medium">
                        {selectedEmployee.employment_date
                          ? format(parseISO(selectedEmployee.employment_date), 'dd.MM.yyyy')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CNP: </span>
                      <span className="font-medium">{selectedEmployee.cnp}</span>
                    </div>
                  </div>
                </div>

                {/* Certificate type selector */}
                <div className="space-y-2">
                  <Label>Tip adeverință</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {certificateTypes.map(ct => (
                      <button
                        key={ct.value}
                        onClick={() => setSelectedType(ct.value)}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          selectedType === ct.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <p className="font-medium text-sm">{ct.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ct.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Purpose */}
                <div className="space-y-2">
                  <Label>Scopul eliberării (opțional)</Label>
                  <Input
                    placeholder="ex: pentru obținerea unui credit bancar..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </div>

                {/* Generate button */}
                <Button onClick={handleGenerate} disabled={generating} className="w-full sm:w-auto">
                  {generating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Se generează...</>
                  ) : (
                    <><Download className="w-4 h-4 mr-2" />Generează DOCX</>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Selectează un angajat din listă pentru a genera adeverința</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CertificateGenerator;
