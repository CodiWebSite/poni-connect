import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download,
  Loader2,
  Sparkles,
  Calendar,
  MapPin,
  Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

type RequestType = 'concediu' | 'adeverinta' | 'delegatie' | 'demisie';
type RequestStatus = 'pending' | 'approved' | 'rejected';

interface HRRequest {
  id: string;
  user_id: string;
  request_type: RequestType;
  status: RequestStatus;
  details: {
    startDate?: string;
    endDate?: string;
    reason?: string;
    purpose?: string;
    destination?: string;
    employeeName: string;
    department: string;
    position: string;
  };
  generated_content: string | null;
  approver_id: string | null;
  approver_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  full_name: string;
  department: string | null;
  position: string | null;
}

const requestTypeLabels: Record<RequestType, string> = {
  concediu: 'Cerere de Concediu',
  adeverinta: 'Adeverință',
  delegatie: 'Ordin de Delegație',
  demisie: 'Cerere de Demisie'
};

const requestTypeIcons: Record<RequestType, React.ReactNode> = {
  concediu: <Calendar className="w-5 h-5" />,
  adeverinta: <FileText className="w-5 h-5" />,
  delegatie: <MapPin className="w-5 h-5" />,
  demisie: <Briefcase className="w-5 h-5" />
};

const statusConfig: Record<RequestStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ReactNode }> = {
  pending: { label: 'În așteptare', variant: 'secondary', icon: <Clock className="w-4 h-4" /> },
  approved: { label: 'Aprobat', variant: 'default', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: 'Respins', variant: 'destructive', icon: <XCircle className="w-4 h-4" /> }
};

const HumanResources = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [requestType, setRequestType] = useState<RequestType>('concediu');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  
  const [selectedRequest, setSelectedRequest] = useState<HRRequest | null>(null);
  const [approverNotes, setApproverNotes] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRequests();
      
      const channel = supabase
        .channel('hr-requests-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hr_requests' },
          () => fetchRequests()
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('full_name, department, position')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('hr_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching requests:', error);
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca cererile.', variant: 'destructive' });
    } else {
      setRequests((data as HRRequest[]) || []);
    }
    
    setLoading(false);
  };

  const generateDocument = async () => {
    if (!profile) {
      toast({ title: 'Eroare', description: 'Profilul nu este complet.', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-hr-document', {
        body: {
          requestType,
          details: {
            employeeName: profile.full_name,
            department: profile.department || 'Nespecificat',
            position: profile.position || 'Nespecificat',
            startDate,
            endDate,
            reason,
            purpose,
            destination
          }
        }
      });

      if (error) throw error;
      
      setGeneratedContent(data.content);
      toast({ title: 'Succes', description: 'Documentul a fost generat cu succes!' });
    } catch (error) {
      console.error('Error generating document:', error);
      toast({ 
        title: 'Eroare', 
        description: 'Nu s-a putut genera documentul. Încercați din nou.', 
        variant: 'destructive' 
      });
    }
    
    setGenerating(false);
  };

  const submitRequest = async () => {
    if (!user || !profile || !generatedContent) return;

    setSubmitting(true);
    
    const { error } = await supabase.from('hr_requests').insert({
      user_id: user.id,
      request_type: requestType,
      details: {
        employeeName: profile.full_name,
        department: profile.department || 'Nespecificat',
        position: profile.position || 'Nespecificat',
        startDate,
        endDate,
        reason,
        purpose,
        destination
      },
      generated_content: generatedContent
    });

    if (error) {
      console.error('Error submitting request:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut trimite cererea.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Cererea a fost trimisă pentru aprobare!' });
      resetForm();
      fetchRequests();
    }
    
    setSubmitting(false);
  };

  const handleApproval = async (approved: boolean) => {
    if (!selectedRequest || !user) return;

    setProcessingApproval(true);
    
    const { error } = await supabase
      .from('hr_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        approver_id: user.id,
        approver_notes: approverNotes
      })
      .eq('id', selectedRequest.id);

    if (error) {
      console.error('Error processing approval:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut procesa cererea.', variant: 'destructive' });
    } else {
      toast({ 
        title: 'Succes', 
        description: `Cererea a fost ${approved ? 'aprobată' : 'respinsă'}.` 
      });
      setSelectedRequest(null);
      setApproverNotes('');
      fetchRequests();
    }
    
    setProcessingApproval(false);
  };

  const downloadDocument = (content: string, type: RequestType) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${requestTypeLabels[type]}_${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    setPurpose('');
    setDestination('');
    setGeneratedContent('');
  };

  const myRequests = requests.filter(r => r.user_id === user?.id);
  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <MainLayout title="Resurse Umane" description="Generează și gestionează documente HR cu ajutorul AI">
      <div className="space-y-6">

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList>
            <TabsTrigger value="create">Creează Document</TabsTrigger>
            <TabsTrigger value="my-requests">
              Cererile Mele
              {myRequests.length > 0 && (
                <Badge variant="secondary" className="ml-2">{myRequests.length}</Badge>
              )}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="approve">
                Aprobări
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Generator Document AI
                  </CardTitle>
                  <CardDescription>
                    Selectați tipul de document și completați detaliile necesare
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tip Document</Label>
                    <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(requestTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              {requestTypeIcons[value as RequestType]}
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(requestType === 'concediu' || requestType === 'delegatie') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Început</Label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Sfârșit</Label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {requestType === 'delegatie' && (
                    <div className="space-y-2">
                      <Label>Destinație</Label>
                      <Input 
                        placeholder="Ex: București, Conferința Națională de Chimie" 
                        value={destination} 
                        onChange={(e) => setDestination(e.target.value)} 
                      />
                    </div>
                  )}

                  {(requestType === 'concediu' || requestType === 'demisie') && (
                    <div className="space-y-2">
                      <Label>Motiv (opțional)</Label>
                      <Textarea 
                        placeholder="Descrieți motivul cererii..." 
                        value={reason} 
                        onChange={(e) => setReason(e.target.value)} 
                      />
                    </div>
                  )}

                  {(requestType === 'adeverinta' || requestType === 'delegatie') && (
                    <div className="space-y-2">
                      <Label>Scopul Documentului</Label>
                      <Textarea 
                        placeholder={requestType === 'adeverinta' ? 'Ex: pentru înscriere la doctorat' : 'Ex: participare la conferință'} 
                        value={purpose} 
                        onChange={(e) => setPurpose(e.target.value)} 
                      />
                    </div>
                  )}

                  <Button 
                    onClick={generateDocument} 
                    disabled={generating || !profile}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Se generează...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generează cu AI
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Previzualizare Document</CardTitle>
                  <CardDescription>
                    Verificați documentul generat înainte de a-l trimite pentru aprobare
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedContent ? (
                    <>
                      <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                          {generatedContent}
                        </pre>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={submitRequest} disabled={submitting} className="flex-1">
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Se trimite...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Trimite pentru Aprobare
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => downloadDocument(generatedContent, requestType)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <FileText className="w-12 h-12 mb-4 opacity-50" />
                      <p>Generați un document pentru a-l previzualiza</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="my-requests">
            <Card>
              <CardHeader>
                <CardTitle>Cererile Mele</CardTitle>
                <CardDescription>Istoricul cererilor trimise și statusul acestora</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : myRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nu aveți cereri trimise</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myRequests.map((request) => (
                      <div 
                        key={request.id} 
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            {requestTypeIcons[request.request_type]}
                          </div>
                          <div>
                            <p className="font-medium">{requestTypeLabels[request.request_type]}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(request.created_at), 'dd MMMM yyyy, HH:mm', { locale: ro })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusConfig[request.status].variant}>
                            {statusConfig[request.status].icon}
                            <span className="ml-1">{statusConfig[request.status].label}</span>
                          </Badge>
                          {request.status === 'approved' && request.generated_content && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => downloadDocument(request.generated_content!, request.request_type)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="approve">
              <Card>
                <CardHeader>
                  <CardTitle>Cereri în Așteptare</CardTitle>
                  <CardDescription>Aprobați sau respingeți cererile angajaților</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : pendingRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nu există cereri în așteptare</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingRequests.map((request) => (
                        <div 
                          key={request.id} 
                          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              {requestTypeIcons[request.request_type]}
                            </div>
                            <div>
                              <p className="font-medium">{requestTypeLabels[request.request_type]}</p>
                              <p className="text-sm text-muted-foreground">
                                {request.details.employeeName} • {request.details.department}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(request.created_at), 'dd MMMM yyyy, HH:mm', { locale: ro })}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            <Clock className="w-4 h-4 mr-1" />
                            În așteptare
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest && requestTypeLabels[selectedRequest.request_type]}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && `Cerere de la ${selectedRequest.details.employeeName}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {selectedRequest.generated_content}
                </pre>
              </div>
              
              <div className="space-y-2">
                <Label>Note (opțional)</Label>
                <Textarea 
                  placeholder="Adăugați note sau comentarii..." 
                  value={approverNotes}
                  onChange={(e) => setApproverNotes(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="destructive" 
                  onClick={() => handleApproval(false)}
                  disabled={processingApproval}
                >
                  {processingApproval ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Respinge
                </Button>
                <Button 
                  onClick={() => handleApproval(true)}
                  disabled={processingApproval}
                >
                  {processingApproval ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Aprobă
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default HumanResources;
