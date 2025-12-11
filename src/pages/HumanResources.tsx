import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from '@/components/hr/SignaturePad';
import { LeaveRequestDocument } from '@/components/hr/LeaveRequestDocument';
import { generateLeaveRequestDocx, generateGenericDocx } from '@/utils/generateDocx';
import { 
  FileText, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download,
  Loader2,
  Calendar,
  MapPin,
  Briefcase,
  PenTool,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

type RequestType = 'concediu' | 'adeverinta' | 'delegatie' | 'demisie';
type RequestStatus = 'pending' | 'approved' | 'rejected';

interface HRRequestDetails {
  startDate?: string;
  endDate?: string;
  reason?: string;
  purpose?: string;
  destination?: string;
  employeeName: string;
  department: string;
  position: string;
  numberOfDays?: number;
  year?: string;
  replacementName?: string;
  replacementPosition?: string;
}

interface HRRequest {
  id: string;
  user_id: string;
  request_type: RequestType;
  status: RequestStatus;
  details: HRRequestDetails;
  generated_content: string | null;
  approver_id: string | null;
  approver_notes: string | null;
  employee_signature: string | null;
  employee_signed_at: string | null;
  department_head_signature: string | null;
  department_head_signed_at: string | null;
  department_head_id: string | null;
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
  const { canApproveHR } = useUserRole();
  const { toast } = useToast();
  const { createNotification } = useNotifications();
  
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employeeRecord, setEmployeeRecord] = useState<{ remaining_leave_days: number; total_leave_days: number; used_leave_days: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isDesignatedDepartmentHead, setIsDesignatedDepartmentHead] = useState(false);
  
  // Form state for leave request
  const [requestType, setRequestType] = useState<RequestType>('concediu');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numberOfDays, setNumberOfDays] = useState<number>(0);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [replacementName, setReplacementName] = useState('');
  const [replacementPosition, setReplacementPosition] = useState('');
  const [employeeSignature, setEmployeeSignature] = useState<string | null>(null);
  
  // Other document types
  const [reason, setReason] = useState('');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generating, setGenerating] = useState(false);
  
  // Approval dialog
  const [selectedRequest, setSelectedRequest] = useState<HRRequest | null>(null);
  const [approverNotes, setApproverNotes] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);
  const [departmentHeadSignature, setDepartmentHeadSignature] = useState<string | null>(null);
  
  // View dialog
  const [viewRequest, setViewRequest] = useState<HRRequest | null>(null);

  // Calculate days when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setNumberOfDays(diffDays);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRequests();
      fetchEmployeeRecord();
      checkIfDesignatedDepartmentHead();
      
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
  }, [user, canApproveHR]);

  const checkIfDesignatedDepartmentHead = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('department_heads')
      .select('id')
      .eq('head_user_id', user.id)
      .maybeSingle();
    
    setIsDesignatedDepartmentHead(!!data);
  };

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

  const fetchEmployeeRecord = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('employee_records')
      .select('remaining_leave_days, total_leave_days, used_leave_days')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setEmployeeRecord(data);
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
    } else if (data) {
      const mappedRequests: HRRequest[] = data.map(item => ({
        ...item,
        details: item.details as unknown as HRRequestDetails,
        request_type: item.request_type as RequestType,
        status: item.status as RequestStatus
      }));
      setRequests(mappedRequests);
    }
    
    setLoading(false);
  };

  const generateOtherDocument = async () => {
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

  const submitLeaveRequest = async () => {
    if (!user || !profile || !employeeSignature) {
      toast({ title: 'Eroare', description: 'Vă rugăm să semnați documentul înainte de trimitere.', variant: 'destructive' });
      return;
    }

    if (!startDate || !numberOfDays) {
      toast({ title: 'Eroare', description: 'Completați toate câmpurile obligatorii.', variant: 'destructive' });
      return;
    }

    // Check leave balance
    if (employeeRecord) {
      if (employeeRecord.remaining_leave_days < numberOfDays) {
        toast({ 
          title: 'Zile insuficiente', 
          description: `Nu aveți suficiente zile de concediu disponibile. Aveți ${employeeRecord.remaining_leave_days} zile, dar ați solicitat ${numberOfDays} zile.`, 
          variant: 'destructive' 
        });
        return;
      }
    }

    setSubmitting(true);
    
    // Find the department head for the user's department
    let assignedDepartmentHeadId: string | null = null;
    if (profile.department) {
      const { data: deptHead } = await supabase
        .from('department_heads')
        .select('head_user_id')
        .eq('department', profile.department)
        .maybeSingle();
      
      if (deptHead) {
        assignedDepartmentHeadId = deptHead.head_user_id;
      }
    }
    
    const { error } = await supabase.from('hr_requests').insert({
      user_id: user.id,
      request_type: 'concediu',
      details: {
        employeeName: profile.full_name,
        department: profile.department || 'Nespecificat',
        position: profile.position || 'Nespecificat',
        startDate,
        endDate,
        numberOfDays,
        year,
        replacementName,
        replacementPosition
      },
      employee_signature: employeeSignature,
      employee_signed_at: new Date().toISOString(),
      department_head_id: assignedDepartmentHeadId
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

  const submitOtherRequest = async () => {
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

  const handleDepartmentHeadSign = async () => {
    if (!selectedRequest || !user || !departmentHeadSignature) return;

    setProcessingApproval(true);
    
    const { error } = await supabase
      .from('hr_requests')
      .update({
        department_head_signature: departmentHeadSignature,
        department_head_signed_at: new Date().toISOString(),
        department_head_id: user.id
      })
      .eq('id', selectedRequest.id);

    if (error) {
      console.error('Error signing:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut semna documentul.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Documentul a fost semnat.' });
      setSelectedRequest({
        ...selectedRequest,
        department_head_signature: departmentHeadSignature,
        department_head_signed_at: new Date().toISOString(),
        department_head_id: user.id
      });
      fetchRequests();
    }
    
    setProcessingApproval(false);
  };

  const handleApproval = async (approved: boolean) => {
    if (!selectedRequest || !user) return;

    // Must sign before approving
    if (!selectedRequest.department_head_signature && !departmentHeadSignature) {
      toast({ title: 'Eroare', description: 'Trebuie să semnați documentul înainte de aprobare.', variant: 'destructive' });
      return;
    }

    setProcessingApproval(true);
    
    const { error } = await supabase
      .from('hr_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        approver_id: user.id,
        approver_notes: approverNotes,
        ...(departmentHeadSignature && !selectedRequest.department_head_signature ? {
          department_head_signature: departmentHeadSignature,
          department_head_signed_at: new Date().toISOString(),
          department_head_id: user.id
        } : {})
      })
      .eq('id', selectedRequest.id);

    if (error) {
      console.error('Error processing approval:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut procesa cererea.', variant: 'destructive' });
    } else {
      // If approved and it's a leave request, update the employee's leave balance
      if (approved && selectedRequest.request_type === 'concediu' && selectedRequest.details.numberOfDays) {
        const { data: currentRecord } = await supabase
          .from('employee_records')
          .select('used_leave_days')
          .eq('user_id', selectedRequest.user_id)
          .maybeSingle();

        if (currentRecord) {
          await supabase
            .from('employee_records')
            .update({
              used_leave_days: currentRecord.used_leave_days + selectedRequest.details.numberOfDays
            })
            .eq('user_id', selectedRequest.user_id);
        }
      }

      // Send notification to the employee
      await createNotification(
        selectedRequest.user_id,
        approved ? 'Cerere Aprobată' : 'Cerere Respinsă',
        `Cererea dvs. de ${requestTypeLabels[selectedRequest.request_type].toLowerCase()} a fost ${approved ? 'aprobată' : 'respinsă'}.${approverNotes ? ` Note: ${approverNotes}` : ''}`,
        approved ? 'success' : 'warning',
        selectedRequest.id,
        'hr_request'
      );
      
      toast({ 
        title: 'Succes', 
        description: `Cererea a fost ${approved ? 'aprobată' : 'respinsă'}.` 
      });
      setSelectedRequest(null);
      setApproverNotes('');
      setDepartmentHeadSignature(null);
      fetchRequests();
    }
    
    setProcessingApproval(false);
  };

  const downloadDocument = async (request: HRRequest) => {
    try {
      if (request.request_type === 'concediu') {
        await generateLeaveRequestDocx({
          employeeName: request.details.employeeName,
          department: request.details.department,
          position: request.details.position,
          numberOfDays: request.details.numberOfDays || 0,
          year: request.details.year || new Date().getFullYear().toString(),
          startDate: request.details.startDate || '',
          endDate: request.details.endDate,
          replacementName: request.details.replacementName,
          replacementPosition: request.details.replacementPosition,
          employeeSignature: request.employee_signature || undefined,
          employeeSignedAt: request.employee_signed_at || undefined,
          departmentHeadSignature: request.department_head_signature || undefined,
          departmentHeadSignedAt: request.department_head_signed_at || undefined,
          status: request.status
        });
      } else {
        await generateGenericDocx(
          request.generated_content || '',
          requestTypeLabels[request.request_type],
          request.details.employeeName
        );
      }
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut genera documentul.', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setNumberOfDays(0);
    setYear(new Date().getFullYear().toString());
    setReplacementName('');
    setReplacementPosition('');
    setEmployeeSignature(null);
    setReason('');
    setPurpose('');
    setDestination('');
    setGeneratedContent('');
  };

  const myRequests = requests.filter(r => r.user_id === user?.id);
  
  // Can see approval tab if user has approval role OR is designated department head
  const canSeeApprovalTab = canApproveHR || isDesignatedDepartmentHead;
  
  // Filter pending requests: show only requests assigned to the current user (as department head)
  // or show all if user has admin/director role
  const pendingRequests = requests.filter(r => {
    if (r.status !== 'pending') return false;
    
    // If user is designated department head, show requests assigned to them
    if (isDesignatedDepartmentHead && r.department_head_id === user?.id) {
      return true;
    }
    
    // If user has admin/super_admin/hr/director role, show all pending requests
    if (canApproveHR) {
      return true;
    }
    
    return false;
  });

  const canApprove = (request: HRRequest) => {
    return request.department_head_signature !== null;
  };

  return (
    <MainLayout title="Resurse Umane" description="Generează și gestionează documente HR">
      <div className="space-y-6">
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="create" className="flex-1 min-w-[120px] text-xs sm:text-sm">
              Creează
            </TabsTrigger>
            <TabsTrigger value="my-requests" className="flex-1 min-w-[120px] text-xs sm:text-sm">
              Cererile Mele
              {myRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">{myRequests.length}</Badge>
              )}
            </TabsTrigger>
            {canSeeApprovalTab && (
              <TabsTrigger value="approve" className="flex-1 min-w-[100px] text-xs sm:text-sm">
                Aprobări
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-1 sm:ml-2 text-xs">{pendingRequests.length}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Cerere Document
                  </CardTitle>
                  <CardDescription>
                    Selectați tipul de document și completați detaliile
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tip Document</Label>
                    <Select value={requestType} onValueChange={(v) => { setRequestType(v as RequestType); resetForm(); }}>
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

                  {requestType === 'concediu' && (
                    <>
                      {/* Leave Balance Info */}
                      {employeeRecord ? (
                        <div className={`p-4 rounded-lg border ${employeeRecord.remaining_leave_days < numberOfDays && numberOfDays > 0 ? 'bg-destructive/10 border-destructive' : 'bg-green-500/10 border-green-500/30'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-5 h-5 text-green-600" />
                              <span className="font-medium">Sold zile concediu:</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-xl font-bold ${employeeRecord.remaining_leave_days < numberOfDays && numberOfDays > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                {employeeRecord.remaining_leave_days}
                              </span>
                              <span className="text-muted-foreground text-sm"> / {employeeRecord.total_leave_days} zile</span>
                            </div>
                          </div>
                          {numberOfDays > 0 && employeeRecord.remaining_leave_days < numberOfDays && (
                            <p className="text-destructive text-sm mt-2">
                              ⚠️ Nu aveți suficiente zile disponibile pentru această cerere!
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border bg-amber-500/10 border-amber-500/30">
                          <p className="text-amber-700 text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Datele despre concediu nu sunt configurate. Contactați HR.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Data Început *</Label>
                          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Data Sfârșit *</Label>
                          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Număr Zile</Label>
                          <Input 
                            type="number" 
                            value={numberOfDays} 
                            onChange={(e) => setNumberOfDays(parseInt(e.target.value) || 0)} 
                            readOnly 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>An Concediu</Label>
                          <Input type="text" value={year} onChange={(e) => setYear(e.target.value)} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Înlocuitor (opțional)</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input 
                            placeholder="Nume înlocuitor" 
                            value={replacementName} 
                            onChange={(e) => setReplacementName(e.target.value)} 
                          />
                          <Input 
                            placeholder="Funcția" 
                            value={replacementPosition} 
                            onChange={(e) => setReplacementPosition(e.target.value)} 
                          />
                        </div>
                      </div>

                      <SignaturePad 
                        label="Semnătura Angajat *"
                        onSave={setEmployeeSignature}
                        existingSignature={employeeSignature}
                      />

                      <Button 
                        onClick={submitLeaveRequest} 
                        disabled={submitting || !employeeSignature || !startDate}
                        className="w-full"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Se trimite...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Trimite Cererea
                          </>
                        )}
                      </Button>
                    </>
                  )}

                  {requestType !== 'concediu' && (
                    <>
                      {requestType === 'delegatie' && (
                        <>
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
                          <div className="space-y-2">
                            <Label>Destinație</Label>
                            <Input 
                              placeholder="Ex: București, Conferința Națională de Chimie" 
                              value={destination} 
                              onChange={(e) => setDestination(e.target.value)} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Scopul</Label>
                            <Textarea 
                              placeholder="Scopul delegației..." 
                              value={purpose} 
                              onChange={(e) => setPurpose(e.target.value)} 
                            />
                          </div>
                        </>
                      )}

                      {requestType === 'adeverinta' && (
                        <div className="space-y-2">
                          <Label>Scopul Adeverinței</Label>
                          <Textarea 
                            placeholder="Ex: pentru înscriere la doctorat" 
                            value={purpose} 
                            onChange={(e) => setPurpose(e.target.value)} 
                          />
                        </div>
                      )}

                      {requestType === 'demisie' && (
                        <div className="space-y-2">
                          <Label>Motiv (opțional)</Label>
                          <Textarea 
                            placeholder="Descrieți motivul cererii..." 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)} 
                          />
                        </div>
                      )}

                      <Button 
                        onClick={generateOtherDocument} 
                        disabled={generating || !profile}
                        className="w-full"
                        variant="outline"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Se generează...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Generează Document
                          </>
                        )}
                      </Button>

                      {generatedContent && (
                        <Button 
                          onClick={submitOtherRequest} 
                          disabled={submitting}
                          className="w-full"
                        >
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
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Preview Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Previzualizare Document</CardTitle>
                  <CardDescription>
                    {requestType === 'concediu' 
                      ? 'Documentul va fi generat conform modelului oficial'
                      : 'Verificați documentul generat înainte de trimitere'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {requestType === 'concediu' ? (
                    <div className="max-h-[600px] overflow-y-auto">
                      <LeaveRequestDocument 
                        employeeName={profile?.full_name || ''}
                        position={profile?.position || ''}
                        department={profile?.department || ''}
                        numberOfDays={numberOfDays}
                        year={year}
                        startDate={startDate}
                        replacementName={replacementName}
                        replacementPosition={replacementPosition}
                        employeeSignature={employeeSignature}
                        employeeSignedAt={employeeSignature ? new Date().toISOString() : null}
                      />
                    </div>
                  ) : generatedContent ? (
                    <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                        {generatedContent}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <FileText className="w-12 h-12 mb-4 opacity-50" />
                      <p>Completați formularul pentru a vedea previzualizarea</p>
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
                            <div className="flex gap-2 mt-1">
                              {request.employee_signature && (
                                <Badge variant="outline" className="text-xs">
                                  <PenTool className="w-3 h-3 mr-1" />
                                  Semnat
                                </Badge>
                              )}
                              {request.department_head_signature && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Șef Dep.
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusConfig[request.status].variant}>
                            {statusConfig[request.status].icon}
                            <span className="ml-1">{statusConfig[request.status].label}</span>
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setViewRequest(request)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadDocument(request)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {canSeeApprovalTab && (
            <TabsContent value="approve">
              <Card>
                <CardHeader>
                  <CardTitle>Cereri în Așteptare</CardTitle>
                  <CardDescription>Semnați și aprobați/respingeți cererile angajaților</CardDescription>
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
                          onClick={() => {
                            setSelectedRequest(request);
                            setDepartmentHeadSignature(request.department_head_signature);
                          }}
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
                          <div className="flex items-center gap-2">
                            {request.department_head_signature ? (
                              <Badge variant="default" className="bg-green-600">
                                <PenTool className="w-4 h-4 mr-1" />
                                Semnat - Așteaptă aprobare
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <PenTool className="w-4 h-4 mr-1" />
                                Necesită semnătură
                              </Badge>
                            )}
                          </div>
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

      {/* View Request Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={() => setViewRequest(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewRequest && requestTypeLabels[viewRequest.request_type]}
            </DialogTitle>
          </DialogHeader>
          
          {viewRequest && viewRequest.request_type === 'concediu' && (
            <LeaveRequestDocument 
              employeeName={viewRequest.details.employeeName}
              position={viewRequest.details.position}
              department={viewRequest.details.department}
              numberOfDays={viewRequest.details.numberOfDays || 0}
              year={viewRequest.details.year || ''}
              startDate={viewRequest.details.startDate || ''}
              replacementName={viewRequest.details.replacementName}
              replacementPosition={viewRequest.details.replacementPosition}
              employeeSignature={viewRequest.employee_signature}
              employeeSignedAt={viewRequest.employee_signed_at}
              departmentHeadSignature={viewRequest.department_head_signature}
              departmentHeadSignedAt={viewRequest.department_head_signed_at}
              directorApproved={viewRequest.status === 'approved'}
            />
          )}
          
          {viewRequest && viewRequest.request_type !== 'concediu' && (
            <div className="bg-muted/50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {viewRequest.generated_content}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => { setSelectedRequest(null); setDepartmentHeadSignature(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              {selectedRequest.request_type === 'concediu' ? (
                <LeaveRequestDocument 
                  employeeName={selectedRequest.details.employeeName}
                  position={selectedRequest.details.position}
                  department={selectedRequest.details.department}
                  numberOfDays={selectedRequest.details.numberOfDays || 0}
                  year={selectedRequest.details.year || ''}
                  startDate={selectedRequest.details.startDate || ''}
                  replacementName={selectedRequest.details.replacementName}
                  replacementPosition={selectedRequest.details.replacementPosition}
                  employeeSignature={selectedRequest.employee_signature}
                  employeeSignedAt={selectedRequest.employee_signed_at}
                  departmentHeadSignature={departmentHeadSignature || selectedRequest.department_head_signature}
                  departmentHeadSignedAt={selectedRequest.department_head_signed_at}
                />
              ) : (
                <div className="bg-muted/50 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {selectedRequest.generated_content}
                  </pre>
                </div>
              )}

              {/* Signature section for department head */}
              {!selectedRequest.department_head_signature && (
                <div className="border-t pt-4">
                  <SignaturePad 
                    label="Semnătura Șef Compartiment *"
                    onSave={(sig) => {
                      setDepartmentHeadSignature(sig);
                    }}
                    existingSignature={departmentHeadSignature}
                  />
                  
                  {departmentHeadSignature && (
                    <Button 
                      onClick={handleDepartmentHeadSign}
                      disabled={processingApproval}
                      className="w-full mt-2"
                      variant="outline"
                    >
                      {processingApproval ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PenTool className="w-4 h-4 mr-2" />}
                      Salvează Semnătura
                    </Button>
                  )}
                </div>
              )}
              
              {/* Approval section - only visible after signing */}
              {(selectedRequest.department_head_signature || departmentHeadSignature) && (
                <div className="border-t pt-4 space-y-4">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default HumanResources;
