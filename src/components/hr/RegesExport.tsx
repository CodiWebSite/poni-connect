import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  FileCode, 
  Users, 
  FileText, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Loader2,
  Settings
} from 'lucide-react';

interface Employee {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  record?: {
    hire_date: string | null;
    contract_type: string;
  };
}

interface LeaveRequest {
  id: string;
  user_id: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface RegesExportProps {
  employees: Employee[];
  leaveRequests?: LeaveRequest[];
}

interface XmlMessage {
  type: string;
  employeeName: string;
  xml: string;
}

export const RegesExport = ({ employees, leaveRequests = [] }: RegesExportProps) => {
  const { toast } = useToast();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedLeaves, setSelectedLeaves] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedXml, setGeneratedXml] = useState<XmlMessage[]>([]);
  const [expandedXml, setExpandedXml] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Config for REGES API (will be needed when they have credentials)
  const [config, setConfig] = useState({
    clientAppId: '',
    authorId: '',
    sessionId: ''
  });
  const [showConfig, setShowConfig] = useState(false);

  const pendingLeaves = leaveRequests.filter(l => l.status === 'approved');

  const toggleEmployee = (userId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleLeave = (leaveId: string) => {
    setSelectedLeaves(prev => 
      prev.includes(leaveId) 
        ? prev.filter(id => id !== leaveId)
        : [...prev, leaveId]
    );
  };

  const selectAllEmployees = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(e => e.user_id));
    }
  };

  const selectAllLeaves = () => {
    if (selectedLeaves.length === pendingLeaves.length) {
      setSelectedLeaves([]);
    } else {
      setSelectedLeaves(pendingLeaves.map(l => l.id));
    }
  };

  const generateXml = async (type: 'employees' | 'contracts' | 'suspensions' | 'batch') => {
    if (type !== 'suspensions' && selectedEmployees.length === 0) {
      toast({ title: 'Atenție', description: 'Selectați cel puțin un angajat.', variant: 'destructive' });
      return;
    }

    if (type === 'suspensions' && selectedLeaves.length === 0) {
      toast({ title: 'Atenție', description: 'Selectați cel puțin o cerere de concediu.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setGeneratedXml([]);

    try {
      const selectedLeaveData = pendingLeaves
        .filter(l => selectedLeaves.includes(l.id))
        .map(l => ({
          contractId: '',
          startDate: l.startDate,
          endDate: l.endDate,
          employeeName: l.employeeName,
          reason: 'Concediu de odihnă'
        }));

      const { data, error } = await supabase.functions.invoke('generate-reges-xml', {
        body: {
          type,
          employeeIds: selectedEmployees,
          leaveRequests: selectedLeaveData,
          config: config.clientAppId ? config : undefined
        }
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedXml(data.messages);
        toast({ 
          title: 'Succes', 
          description: `Au fost generate ${data.count} fișiere XML.` 
        });
      }
    } catch (error: any) {
      console.error('XML generation error:', error);
      toast({ 
        title: 'Eroare', 
        description: error.message || 'Nu s-au putut genera fișierele XML.', 
        variant: 'destructive' 
      });
    }

    setLoading(false);
  };

  const copyToClipboard = async (xml: string, index: number) => {
    try {
      await navigator.clipboard.writeText(xml);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast({ title: 'Copiat', description: 'XML copiat în clipboard.' });
    } catch (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut copia.', variant: 'destructive' });
    }
  };

  const downloadXml = (xml: string, filename: string) => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllXml = () => {
    generatedXml.forEach((msg, index) => {
      const filename = `reges_${msg.type}_${msg.employeeName.replace(/\s+/g, '_')}_${index + 1}.xml`;
      downloadXml(msg.xml, filename);
    });
    toast({ title: 'Descărcare', description: `${generatedXml.length} fișiere XML descărcate.` });
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Export XML pentru REGES Online
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Generați fișiere XML compatibile cu platforma REGES a Inspecției Muncii. 
                Completați câmpurile marcate (CNP, adresă, salariu, cod COR) înainte de transmitere.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Config Section */}
      <Collapsible open={showConfig} onOpenChange={setShowConfig}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurare API REGES (opțional)
            </span>
            {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Aceste câmpuri sunt necesare doar pentru integrarea API directă cu REGES. 
                  Pentru export manual, le puteți lăsa goale.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="clientAppId">Client Application ID</Label>
                  <Input
                    id="clientAppId"
                    placeholder="UUID de la Inspecția Muncii"
                    value={config.clientAppId}
                    onChange={(e) => setConfig(prev => ({ ...prev, clientAppId: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorId">Author ID</Label>
                  <Input
                    id="authorId"
                    placeholder="UUID autor"
                    value={config.authorId}
                    onChange={(e) => setConfig(prev => ({ ...prev, authorId: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionId">Session ID</Label>
                  <Input
                    id="sessionId"
                    placeholder="UUID sesiune (opțional)"
                    value={config.sessionId}
                    onChange={(e) => setConfig(prev => ({ ...prev, sessionId: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" />
            Salariați
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="h-4 w-4" />
            Contracte
          </TabsTrigger>
          <TabsTrigger value="suspensions" className="gap-2">
            <Calendar className="h-4 w-4" />
            Suspendări
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export Salariați</CardTitle>
              <CardDescription>
                Generează XML pentru înregistrarea salariaților în REGES
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">
                  {selectedEmployees.length} din {employees.length} selectați
                </Label>
                <Button variant="outline" size="sm" onClick={selectAllEmployees}>
                  {selectedEmployees.length === employees.length ? 'Deselectează tot' : 'Selectează tot'}
                </Button>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg p-2">
                <div className="space-y-2">
                  {employees.map(emp => (
                    <div 
                      key={emp.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedEmployees.includes(emp.user_id)}
                        onCheckedChange={() => toggleEmployee(emp.user_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{emp.full_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {emp.department || 'Fără departament'} • {emp.position || 'Fără funcție'}
                        </p>
                      </div>
                      {emp.record?.hire_date && (
                        <Badge variant="outline" className="text-xs">
                          {emp.record.contract_type === 'nedeterminat' ? 'Nedeterminat' : 'Determinat'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button 
                  onClick={() => generateXml('employees')} 
                  disabled={loading || selectedEmployees.length === 0}
                  className="flex-1"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCode className="h-4 w-4 mr-2" />}
                  Generează XML Salariați
                </Button>
                <Button 
                  onClick={() => generateXml('batch')} 
                  disabled={loading || selectedEmployees.length === 0}
                  variant="secondary"
                >
                  Generează Tot (Salariați + Contracte)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export Contracte</CardTitle>
              <CardDescription>
                Generează XML pentru înregistrarea contractelor în REGES
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">
                  {selectedEmployees.length} din {employees.length} selectați
                </Label>
                <Button variant="outline" size="sm" onClick={selectAllEmployees}>
                  {selectedEmployees.length === employees.length ? 'Deselectează tot' : 'Selectează tot'}
                </Button>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg p-2">
                <div className="space-y-2">
                  {employees.map(emp => (
                    <div 
                      key={emp.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedEmployees.includes(emp.user_id)}
                        onCheckedChange={() => toggleEmployee(emp.user_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{emp.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {emp.record?.hire_date 
                            ? `Angajat din ${new Date(emp.record.hire_date).toLocaleDateString('ro-RO')}`
                            : 'Dată angajare nesetată'
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button 
                onClick={() => generateXml('contracts')} 
                disabled={loading || selectedEmployees.length === 0}
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCode className="h-4 w-4 mr-2" />}
                Generează XML Contracte
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suspensions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export Suspendări (Concedii)</CardTitle>
              <CardDescription>
                Generează XML pentru raportarea concediilor aprobate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingLeaves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nu există concedii aprobate de exportat</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">
                      {selectedLeaves.length} din {pendingLeaves.length} selectate
                    </Label>
                    <Button variant="outline" size="sm" onClick={selectAllLeaves}>
                      {selectedLeaves.length === pendingLeaves.length ? 'Deselectează tot' : 'Selectează tot'}
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[300px] border rounded-lg p-2">
                    <div className="space-y-2">
                      {pendingLeaves.map(leave => (
                        <div 
                          key={leave.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedLeaves.includes(leave.id)}
                            onCheckedChange={() => toggleLeave(leave.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{leave.employeeName}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(leave.startDate).toLocaleDateString('ro-RO')} - {new Date(leave.endDate).toLocaleDateString('ro-RO')}
                            </p>
                          </div>
                          <Badge variant="secondary">Aprobat</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button 
                    onClick={() => generateXml('suspensions')} 
                    disabled={loading || selectedLeaves.length === 0}
                    className="w-full"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCode className="h-4 w-4 mr-2" />}
                    Generează XML Suspendări
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generated XML Results */}
      {generatedXml.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Fișiere XML Generate</CardTitle>
                <CardDescription>{generatedXml.length} fișiere gata pentru descărcare</CardDescription>
              </div>
              <Button onClick={downloadAllXml} variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Descarcă Toate
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {generatedXml.map((msg, index) => (
                  <Collapsible 
                    key={index}
                    open={expandedXml === index}
                    onOpenChange={() => setExpandedXml(expandedXml === index ? null : index)}
                  >
                    <div className="border rounded-lg">
                      <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileCode className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <p className="font-medium">{msg.employeeName}</p>
                            <p className="text-sm text-muted-foreground">{msg.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(msg.xml, index);
                            }}
                          >
                            {copiedIndex === index ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadXml(msg.xml, `reges_${msg.type}_${msg.employeeName.replace(/\s+/g, '_')}.xml`);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {expandedXml === index ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t p-3 bg-muted/30">
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                            {msg.xml}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
