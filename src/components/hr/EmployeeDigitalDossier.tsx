import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Search, FolderOpen, AlertTriangle, FileText, Download, User, Clock, Shield, CreditCard, FileCheck, Briefcase, ChevronRight, Calendar, Upload, Plus, Loader2 } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

interface EmployeeBasic {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  cnp: string;
  department: string | null;
  position: string | null;
  employment_date: string;
  employee_record_id: string | null;
  user_id?: string;
  hasAccount: boolean;
}

interface DossierDocument {
  id: string;
  source: string; // 'employee_documents' | 'archive' | 'ci_scan' | 'medical' | 'leave_scan'
  name: string;
  type: string;
  date: string;
  fileUrl: string | null;
  bucket: string | null;
  expiresAt?: string | null;
  status: 'valid' | 'expiring' | 'expired' | 'none';
}

interface ExpiryAlert {
  employeeName: string;
  employeeId: string;
  documentType: string;
  expiresAt: string;
  daysLeft: number;
}

const ALERT_THRESHOLD_DAYS = 90;

const DOC_TYPE_LABELS: Record<string, string> = {
  cv: 'CV',
  contract: 'Contract de Muncă',
  anexa: 'Anexă Contract',
  certificat: 'Certificat',
  diploma: 'Diplomă',
  adeverinta: 'Adeverință',
  altele: 'Altele',
  scanare_co: 'Scanare Concediu Odihnă',
  scanare_cm: 'Scanare Concediu Medical',
  scanare_ev: 'Scanare Eveniment',
  scanare_np: 'Scanare Concediu Neplătit',
  ci_scan: 'Scanare CI',
  medical_doc: 'Document Medical',
};

export default function EmployeeDigitalDossier({ employees }: { employees: EmployeeBasic[] }) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'expiring'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeBasic | null>(null);
  const [dossierDocs, setDossierDocs] = useState<DossierDocument[]>([]);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const departments = useMemo(() => {
    const depts = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];
    return depts.sort();
  }, [employees]);

  // Fetch CI expiry alerts across all employees
  useEffect(() => {
    fetchExpiryAlerts();
  }, [employees]);

  const fetchExpiryAlerts = async () => {
    setLoadingAlerts(true);
    const today = new Date();
    const thresholdDate = addDays(today, ALERT_THRESHOLD_DAYS);

    // CI expiry from employee_personal_data
    const { data: ciData } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, ci_expiry_date')
      .eq('is_archived', false)
      .not('ci_expiry_date', 'is', null);

    const alerts: ExpiryAlert[] = [];
    (ciData || []).forEach(emp => {
      if (!emp.ci_expiry_date) return;
      const expDate = new Date(emp.ci_expiry_date);
      const daysLeft = differenceInDays(expDate, today);
      if (daysLeft <= ALERT_THRESHOLD_DAYS) {
        alerts.push({
          employeeName: `${emp.last_name} ${emp.first_name}`,
          employeeId: emp.id,
          documentType: 'Carte de Identitate',
          expiresAt: emp.ci_expiry_date,
          daysLeft,
        });
      }
    });

    // Medical consultation expiries
    const { data: medData } = await supabase
      .from('medical_consultations')
      .select('medical_record_id, next_consultation_date, consultation_type')
      .not('next_consultation_date', 'is', null);

    if (medData && medData.length > 0) {
      const recordIds = [...new Set(medData.map(m => m.medical_record_id))];
      const { data: medRecords } = await supabase
        .from('medical_records')
        .select('id, epd_id')
        .in('id', recordIds);

      const recordToEpd = new Map<string, string>();
      (medRecords || []).forEach((r: any) => recordToEpd.set(r.id, r.epd_id));

      const empIds = [...new Set([...recordToEpd.values()])];
      const { data: empNames } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name')
        .in('id', empIds);

      const nameMap = new Map<string, string>();
      (empNames || []).forEach(e => nameMap.set(e.id, `${e.last_name} ${e.first_name}`));

      medData.forEach(m => {
        if (!m.next_consultation_date) return;
        const expDate = new Date(m.next_consultation_date);
        const daysLeft = differenceInDays(expDate, today);
        if (daysLeft <= ALERT_THRESHOLD_DAYS) {
          const epdId = recordToEpd.get(m.medical_record_id);
          if (epdId) {
            alerts.push({
              employeeName: nameMap.get(epdId) || 'Necunoscut',
              employeeId: epdId,
              documentType: `Consultație medicală (${m.consultation_type})`,
              expiresAt: m.next_consultation_date,
              daysLeft,
            });
          }
        }
      });
    }

    alerts.sort((a, b) => a.daysLeft - b.daysLeft);
    setExpiryAlerts(alerts);
    setLoadingAlerts(false);
  };

  const openDossier = async (emp: EmployeeBasic) => {
    setSelectedEmployee(emp);
    setLoadingDossier(true);
    const docs: DossierDocument[] = [];
    const today = new Date();

    // 1. Employee documents
    const { data: empDocs } = await supabase
      .from('employee_documents')
      .select('*')
      .or(`user_id.eq.${emp.user_id || '00000000-0000-0000-0000-000000000000'},user_id.eq.${emp.id}`)
      .order('created_at', { ascending: false });

    (empDocs || []).forEach(d => {
      docs.push({
        id: d.id,
        source: 'employee_documents',
        name: d.name,
        type: d.document_type,
        date: d.created_at,
        fileUrl: d.file_url,
        bucket: 'employee-documents',
        status: 'valid',
      });
    });

    // 2. CI scan from employee_personal_data
    const { data: ciInfo } = await supabase
      .from('employee_personal_data')
      .select('ci_scan_url, ci_scan_uploaded_at, ci_expiry_date, ci_series, ci_number')
      .eq('id', emp.id)
      .maybeSingle();

    if (ciInfo?.ci_scan_url) {
      const ciExpiry = ciInfo.ci_expiry_date ? new Date(ciInfo.ci_expiry_date) : null;
      const daysLeft = ciExpiry ? differenceInDays(ciExpiry, today) : null;
      let status: DossierDocument['status'] = 'valid';
      if (daysLeft !== null) {
        if (daysLeft < 0) status = 'expired';
        else if (daysLeft <= ALERT_THRESHOLD_DAYS) status = 'expiring';
      }
      docs.push({
        id: `ci-${emp.id}`,
        source: 'ci_scan',
        name: `CI ${ciInfo.ci_series || ''} ${ciInfo.ci_number || ''}`.trim() || 'Carte de Identitate',
        type: 'ci_scan',
        date: ciInfo.ci_scan_uploaded_at || '',
        fileUrl: ciInfo.ci_scan_url,
        bucket: 'employee-documents',
        expiresAt: ciInfo.ci_expiry_date,
        status,
      });
    }

    // 3. Medical documents
    const { data: medRecords } = await supabase
      .from('medical_records')
      .select('id')
      .eq('epd_id', emp.id);

    if (medRecords && medRecords.length > 0) {
      const medRecordIds = medRecords.map(r => r.id);
      const { data: medDocs } = await supabase
        .from('medical_documents')
        .select('*')
        .in('medical_record_id', medRecordIds)
        .order('created_at', { ascending: false });

      (medDocs || []).forEach(d => {
        docs.push({
          id: d.id,
          source: 'medical',
          name: d.file_name || 'Document Medical',
          type: 'medical_doc',
          date: d.created_at,
          fileUrl: d.file_url,
          bucket: 'medical-documents',
          status: 'valid',
        });
      });
    }

    // 4. Archive documents by department
    if (emp.department) {
      const { data: archiveDocs } = await supabase
        .from('archive_documents')
        .select('*')
        .eq('department', emp.department)
        .order('archived_at', { ascending: false })
        .limit(20);

      (archiveDocs || []).forEach(d => {
        const expiry = d.retention_expires_at;
        let status: DossierDocument['status'] = 'valid';
        if (expiry && d.retention_years < 100) {
          const daysLeft = differenceInDays(new Date(expiry), today);
          if (daysLeft < 0) status = 'expired';
          else if (daysLeft <= ALERT_THRESHOLD_DAYS) status = 'expiring';
        }
        docs.push({
          id: d.id,
          source: 'archive',
          name: d.file_name || d.description || 'Document Arhivă',
          type: d.nomenclator_category,
          date: d.archived_at,
          fileUrl: d.file_url,
          bucket: 'archive-documents',
          expiresAt: expiry,
          status,
        });
      });
    }

    setDossierDocs(docs);
    setLoadingDossier(false);
  };

  const handleDownload = async (doc: DossierDocument) => {
    if (!doc.fileUrl || !doc.bucket) return;
    const { data, error } = await supabase.storage.from(doc.bucket).download(doc.fileUrl);
    if (error || !data) {
      toast({ title: 'Eroare la descărcare', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name || 'document';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (deptFilter !== 'all') list = list.filter(e => e.department === deptFilter);
    if (alertFilter === 'expiring') {
      const alertIds = new Set(expiryAlerts.map(a => a.employeeId));
      list = list.filter(e => alertIds.has(e.id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.full_name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.cnp.includes(q)
      );
    }
    return list;
  }, [employees, deptFilter, alertFilter, search, expiryAlerts]);

  const getStatusBadge = (status: DossierDocument['status']) => {
    switch (status) {
      case 'expired':
        return <Badge variant="destructive" className="text-xs">Expirat</Badge>;
      case 'expiring':
        return <Badge className="bg-amber-500 text-white text-xs">Expiră curând</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Valid</Badge>;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'employee_documents': return 'Documente Angajat';
      case 'ci_scan': return 'Carte de Identitate';
      case 'medical': return 'Medicină Muncii';
      case 'archive': return 'Arhivă';
      case 'leave_scan': return 'Scanare Concediu';
      default: return source;
    }
  };

  const expiredCount = expiryAlerts.filter(a => a.daysLeft < 0).length;
  const expiringCount = expiryAlerts.filter(a => a.daysLeft >= 0).length;

  return (
    <div className="space-y-6">
      {/* Alerts summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FolderOpen className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{employees.length}</p>
              <p className="text-sm text-muted-foreground">Dosare digitale</p>
            </div>
          </CardContent>
        </Card>
        <Card className={expiringCount > 0 ? 'border-amber-400' : ''}>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{expiringCount}</p>
              <p className="text-sm text-muted-foreground">Expiră în {ALERT_THRESHOLD_DAYS} zile</p>
            </div>
          </CardContent>
        </Card>
        <Card className={expiredCount > 0 ? 'border-destructive' : ''}>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{expiredCount}</p>
              <p className="text-sm text-muted-foreground">Documente expirate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiry alerts list */}
      {expiryAlerts.length > 0 && (
        <Card className="border-amber-400/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alerte documente ({expiryAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Angajat</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Dată expirare</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiryAlerts.slice(0, 10).map((alert, idx) => (
                  <TableRow key={idx} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    const emp = employees.find(e => e.id === alert.employeeId);
                    if (emp) openDossier(emp);
                  }}>
                    <TableCell className="font-medium text-sm">{alert.employeeName}</TableCell>
                    <TableCell className="text-sm">{alert.documentType}</TableCell>
                    <TableCell className="text-sm">{format(new Date(alert.expiresAt), 'dd MMM yyyy', { locale: ro })}</TableCell>
                    <TableCell>
                      {alert.daysLeft < 0 ? (
                        <Badge variant="destructive" className="text-xs">Expirat ({Math.abs(alert.daysLeft)} zile)</Badge>
                      ) : (
                        <Badge className="bg-amber-500 text-white text-xs">Mai sunt {alert.daysLeft} zile</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {expiryAlerts.length > 10 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-2">
                      ... și încă {expiryAlerts.length - 10} alerte
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Caută după nume, email sau CNP..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Departament" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate departamentele</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={alertFilter} onValueChange={(v: 'all' | 'expiring') => setAlertFilter(v)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toți angajații</SelectItem>
                <SelectItem value="expiring">Cu alerte active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee list */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Angajat</TableHead>
                <TableHead className="hidden md:table-cell">Departament</TableHead>
                <TableHead className="hidden md:table-cell">Funcție</TableHead>
                <TableHead className="hidden lg:table-cell">Angajat din</TableHead>
                <TableHead className="text-right">Dosar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    Niciun angajat găsit
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.map(emp => {
                const hasAlert = expiryAlerts.some(a => a.employeeId === emp.id);
                return (
                  <TableRow key={emp.id} className={`cursor-pointer hover:bg-muted/50 ${hasAlert ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`} onClick={() => openDossier(emp)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {hasAlert && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                        <div>
                          <p className="font-medium text-sm">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{emp.department || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{emp.position || '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {format(new Date(emp.employment_date), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="gap-1">
                        <FolderOpen className="h-4 w-4" /> Deschide
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dossier Dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedEmployee && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  Dosar Digital — {selectedEmployee.full_name}
                </DialogTitle>
              </DialogHeader>

              {/* Employee summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">CNP</p>
                    <p className="font-mono">{selectedEmployee.cnp}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Departament</p>
                    <p>{selectedEmployee.department || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Funcție</p>
                    <p>{selectedEmployee.position || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Data angajării</p>
                    <p>{format(new Date(selectedEmployee.employment_date), 'dd.MM.yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* Dossier documents by source */}
              {loadingDossier ? (
                <div className="text-center py-8 text-muted-foreground">Se încarcă dosarul...</div>
              ) : dossierDocs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  Nu există documente în dosar
                </div>
              ) : (
                <Tabs defaultValue="all" className="mt-2">
                  <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="all" className="text-xs">Toate ({dossierDocs.length})</TabsTrigger>
                    {['ci_scan', 'employee_documents', 'medical', 'archive'].map(src => {
                      const count = dossierDocs.filter(d => d.source === src).length;
                      if (count === 0) return null;
                      return (
                        <TabsTrigger key={src} value={src} className="text-xs">
                          {getSourceLabel(src)} ({count})
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {['all', 'ci_scan', 'employee_documents', 'medical', 'archive'].map(tabVal => (
                    <TabsContent key={tabVal} value={tabVal}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead className="hidden md:table-cell">Sursă</TableHead>
                            <TableHead className="hidden md:table-cell">Dată</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Acțiuni</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dossierDocs
                            .filter(d => tabVal === 'all' || d.source === tabVal)
                            .map(doc => (
                              <TableRow key={doc.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">{doc.name}</p>
                                    <p className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[doc.type] || doc.type}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-xs">
                                  <Badge variant="outline">{getSourceLabel(doc.source)}</Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                  {doc.date ? format(new Date(doc.date), 'dd.MM.yyyy') : '—'}
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(doc.status)}
                                  {doc.expiresAt && doc.status !== 'valid' && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {format(new Date(doc.expiresAt), 'dd.MM.yyyy')}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {doc.fileUrl && (
                                    <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)} title="Descarcă">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
