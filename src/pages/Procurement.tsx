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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  ShoppingCart, 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  Send,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  Package,
  Building,
  Calendar,
  DollarSign,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ProcurementItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  specifications?: string;
}

interface ProcurementRequest {
  id: string;
  request_number: string;
  user_id: string;
  department: string;
  title: string;
  description: string;
  justification: string;
  category: string;
  urgency: string;
  estimated_value: number;
  currency: string;
  budget_source: string | null;
  items: ProcurementItem[];
  status: string;
  created_at: string;
  updated_at: string;
  department_head_id: string | null;
  department_head_approved_at: string | null;
  department_head_notes: string | null;
  director_id: string | null;
  director_approved_at: string | null;
  director_notes: string | null;
  rejection_reason: string | null;
  requester?: {
    full_name: string;
    department: string | null;
  };
}

interface Profile {
  full_name: string;
  department: string | null;
  position: string | null;
}

const categoryLabels: Record<string, string> = {
  consumabile_laborator: 'Consumabile Laborator',
  echipamente_it: 'Echipamente IT',
  birotica: 'Birotică',
  echipamente_cercetare: 'Echipamente Cercetare',
  servicii: 'Servicii',
  mobilier: 'Mobilier',
  altele: 'Altele'
};

const urgencyLabels: Record<string, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'bg-gray-500' },
  urgent: { label: 'Urgent', color: 'bg-amber-500' },
  foarte_urgent: { label: 'Foarte Urgent', color: 'bg-red-500' }
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  draft: { label: 'Ciornă', variant: 'outline', icon: <FileText className="w-3 h-3" /> },
  pending_department_head: { label: 'Așteaptă Șef Compartiment', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  pending_procurement: { label: 'Așteaptă Achiziții', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  pending_director: { label: 'Așteaptă Director', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  pending_cfp: { label: 'Așteaptă CFP', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'Aprobat', variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Respins', variant: 'destructive', icon: <XCircle className="w-3 h-3" /> }
};

const Procurement = () => {
  const { user } = useAuth();
  const { role, isProcurement, isAdmin, isSuperAdmin } = useUserRole();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    justification: '',
    category: 'altele',
    urgency: 'normal',
    estimated_value: '',
    budget_source: ''
  });
  const [items, setItems] = useState<ProcurementItem[]>([
    { name: '', quantity: 1, unit: 'buc', estimatedPrice: 0, specifications: '' }
  ]);

  // View dialog
  const [viewingRequest, setViewingRequest] = useState<ProcurementRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Only achizitii_contabilitate role can approve
  const canApprove = isProcurement;

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, department, position')
      .eq('user_id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch user's requests
    const { data: userRequests } = await supabase
      .from('procurement_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (userRequests) {
      setRequests(userRequests.map(r => ({ ...r, items: r.items as unknown as ProcurementItem[] })) as ProcurementRequest[]);
    }

    // Fetch pending approvals if user is in procurement department
    if (canApprove) {
      const { data: approvals } = await supabase
        .from('procurement_requests')
        .select('*')
        .neq('user_id', user.id)
        .in('status', ['pending_department_head', 'pending_director', 'pending_procurement', 'pending_cfp'])
        .order('created_at', { ascending: false });

      if (approvals) {
        // Fetch requester info for each request
        const requestsWithRequester = await Promise.all(
          approvals.map(async (req) => {
            const { data: requesterProfile } = await supabase
              .from('profiles')
              .select('full_name, department')
              .eq('user_id', req.user_id)
              .single();
            return { 
              ...req, 
              items: req.items as unknown as ProcurementItem[],
              requester: requesterProfile 
            } as ProcurementRequest;
          })
        );
        setPendingApprovals(requestsWithRequester);
      }
    }

    setLoading(false);
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unit: 'buc', estimatedPrice: 0, specifications: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ProcurementItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);

    // Auto-calculate total
    const total = newItems.reduce((sum, item) => sum + (item.quantity * item.estimatedPrice), 0);
    setFormData(prev => ({ ...prev, estimated_value: total.toFixed(2) }));
  };

  const submitRequest = async (asDraft: boolean = false) => {
    if (!user || !profile) return;

    if (!formData.title || !formData.description || !formData.justification) {
      toast({ title: 'Eroare', description: 'Completați toate câmpurile obligatorii.', variant: 'destructive' });
      return;
    }

    if (items.some(item => !item.name || item.quantity <= 0)) {
      toast({ title: 'Eroare', description: 'Completați toate articolele corect.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const insertData = {
      request_number: '', // Will be auto-generated by trigger
      user_id: user.id,
      department: profile.department || 'Nespecificat',
      title: formData.title,
      description: formData.description,
      justification: formData.justification,
      category: formData.category as any,
      urgency: formData.urgency as any,
      estimated_value: parseFloat(formData.estimated_value) || 0,
      budget_source: formData.budget_source || null,
      items: items as any,
      status: (asDraft ? 'draft' : 'pending_department_head') as any
    };

    const { data: insertedData, error } = await supabase
      .from('procurement_requests')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Error creating request:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut crea referatul.', variant: 'destructive' });
    } else {
      // Send notification to procurement users if submitted (not draft)
      if (!asDraft) {
        await sendProcurementNotification(insertedData.id, insertedData.request_number, formData.title);
      }
      
      toast({ 
        title: 'Succes', 
        description: asDraft ? 'Referatul a fost salvat ca ciornă.' : 'Referatul a fost trimis spre aprobare.' 
      });
      resetForm();
      fetchData();
    }

    setSubmitting(false);
  };

  const sendProcurementNotification = async (requestId: string, requestNumber: string, title: string) => {
    // Find all users with achizitii_contabilitate role
    const { data: procurementUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'achizitii_contabilitate');

    if (procurementUsers && procurementUsers.length > 0) {
      const notifications = procurementUsers.map(u => ({
        user_id: u.user_id,
        title: 'Referat de necesitate nou',
        message: `Un nou referat "${title}" (${requestNumber}) așteaptă aprobarea dvs.`,
        type: 'procurement',
        related_type: 'procurement_request',
        related_id: requestId
      }));

      await supabase.from('notifications').insert(notifications);
    }
  };

  const resetForm = () => {
    setShowNewRequest(false);
    setFormData({
      title: '',
      description: '',
      justification: '',
      category: 'altele',
      urgency: 'normal',
      estimated_value: '',
      budget_source: ''
    });
    setItems([{ name: '', quantity: 1, unit: 'buc', estimatedPrice: 0, specifications: '' }]);
  };

  const handleApproval = async (approved: boolean) => {
    if (!viewingRequest || !user) return;

    setProcessing(true);

    let newStatus = viewingRequest.status;
    const updateData: any = {
      procurement_officer_id: user.id,
      procurement_approved_at: new Date().toISOString(),
      procurement_notes: approvalNotes || null
    };

    if (approved) {
      newStatus = 'approved';
    } else {
      newStatus = 'rejected';
      updateData.rejected_by = user.id;
      updateData.rejected_at = new Date().toISOString();
      updateData.rejection_reason = approvalNotes || 'Fără motiv specificat';
    }

    const { error } = await supabase
      .from('procurement_requests')
      .update({ status: newStatus, ...updateData })
      .eq('id', viewingRequest.id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut procesa cererea.', variant: 'destructive' });
    } else {
      // Send notification to the requester
      await supabase.from('notifications').insert({
        user_id: viewingRequest.user_id,
        title: approved ? 'Referat aprobat' : 'Referat respins',
        message: approved 
          ? `Referatul "${viewingRequest.title}" (${viewingRequest.request_number}) a fost aprobat.`
          : `Referatul "${viewingRequest.title}" (${viewingRequest.request_number}) a fost respins. Motiv: ${approvalNotes || 'Nespecificat'}`,
        type: 'procurement',
        related_type: 'procurement_request',
        related_id: viewingRequest.id
      });

      toast({ 
        title: approved ? 'Aprobat' : 'Respins', 
        description: approved ? 'Referatul a fost aprobat.' : 'Referatul a fost respins.' 
      });
      setViewingRequest(null);
      setApprovalNotes('');
      fetchData();
    }

    setProcessing(false);
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Sigur doriți să ștergeți acest referat?')) return;

    const { error } = await supabase
      .from('procurement_requests')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge referatul.', variant: 'destructive' });
    } else {
      toast({ title: 'Șters', description: 'Referatul a fost șters.' });
      fetchData();
    }
  };

  const submitDraft = async (id: string) => {
    const request = requests.find(r => r.id === id);
    
    const { error } = await supabase
      .from('procurement_requests')
      .update({ status: 'pending_department_head' })
      .eq('id', id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut trimite referatul.', variant: 'destructive' });
    } else {
      // Send notification to procurement users
      if (request) {
        await sendProcurementNotification(id, request.request_number, request.title);
      }
      toast({ title: 'Trimis', description: 'Referatul a fost trimis spre aprobare.' });
      fetchData();
    }
  };

  if (loading) {
    return (
      <MainLayout title="Achiziții Publice">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Achiziții Publice" description="Referate de necesitate și aprobare achiziții">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{requests.length}</p>
                  <p className="text-xs text-muted-foreground">Referatele Mele</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {requests.filter(r => r.status.startsWith('pending')).length}
                  </p>
                  <p className="text-xs text-muted-foreground">În Așteptare</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {requests.filter(r => r.status === 'approved').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Aprobate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {canApprove && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{pendingApprovals.length}</p>
                    <p className="text-xs text-muted-foreground">De Aprobat</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="my-requests" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList>
              <TabsTrigger value="my-requests">Referatele Mele</TabsTrigger>
              {canApprove && (
                <TabsTrigger value="approvals">
                  De Aprobat
                  {pendingApprovals.length > 0 && (
                    <Badge variant="destructive" className="ml-2">{pendingApprovals.length}</Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>
            <Button onClick={() => setShowNewRequest(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Referat Nou
            </Button>
          </div>

          {/* My Requests Tab */}
          <TabsContent value="my-requests">
            <Card>
              <CardHeader>
                <CardTitle>Referatele Mele de Necesitate</CardTitle>
                <CardDescription>Toate cererile de achiziție create de dvs.</CardDescription>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Nu aveți referate de necesitate</p>
                    <p className="text-sm">Creați primul referat apăsând butonul "Referat Nou"</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">
                              {request.request_number}
                            </span>
                            <Badge variant={statusConfig[request.status]?.variant || 'outline'}>
                              {statusConfig[request.status]?.icon}
                              <span className="ml-1">{statusConfig[request.status]?.label}</span>
                            </Badge>
                            <Badge className={urgencyLabels[request.urgency]?.color}>
                              {urgencyLabels[request.urgency]?.label}
                            </Badge>
                          </div>
                          <h4 className="font-medium">{request.title}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {categoryLabels[request.category]}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {request.estimated_value.toLocaleString()} {request.currency}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(request.created_at), 'dd MMM yyyy', { locale: ro })}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setViewingRequest(request)}>
                            <Eye className="w-4 h-4 mr-1" />
                            Vezi
                          </Button>
                          {request.status === 'draft' && (
                            <Button variant="outline" size="sm" onClick={() => submitDraft(request.id)}>
                              <Send className="w-4 h-4 mr-1" />
                              Trimite
                            </Button>
                          )}
                          {request.status !== 'approved' && request.status !== 'rejected' && (
                            <Button variant="destructive" size="sm" onClick={() => deleteRequest(request.id)}>
                              <Trash2 className="w-4 h-4" />
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

          {/* Approvals Tab */}
          {canApprove && (
            <TabsContent value="approvals">
              <Card>
                <CardHeader>
                  <CardTitle>Referate de Aprobat</CardTitle>
                  <CardDescription>Cereri care așteaptă aprobarea dvs.</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingApprovals.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">Nu aveți referate de aprobat</p>
                      <p className="text-sm">Toate cererile au fost procesate</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingApprovals.map((request) => (
                        <div
                          key={request.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-muted-foreground">
                                {request.request_number}
                              </span>
                              <Badge variant={statusConfig[request.status]?.variant || 'outline'}>
                                {statusConfig[request.status]?.icon}
                                <span className="ml-1">{statusConfig[request.status]?.label}</span>
                              </Badge>
                              <Badge className={urgencyLabels[request.urgency]?.color}>
                                {urgencyLabels[request.urgency]?.label}
                              </Badge>
                            </div>
                            <h4 className="font-medium">{request.title}</h4>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {request.requester?.full_name || 'Necunoscut'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {request.department}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                {request.estimated_value.toLocaleString()} {request.currency}
                              </span>
                            </div>
                          </div>
                          <Button onClick={() => setViewingRequest(request)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Revizuiește
                          </Button>
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

      {/* New Request Dialog */}
      <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Referat de Necesitate Nou</DialogTitle>
            <DialogDescription>
              Completați datele pentru a crea un nou referat de achiziție
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titlu *</Label>
                <Input
                  placeholder="ex: Achiziție consumabile laborator"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categorie</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descriere *</Label>
              <Textarea
                placeholder="Descrieți pe scurt ce doriți să achiziționați..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Justificare / Necesitate *</Label>
              <Textarea
                placeholder="Explicați de ce este necesară această achiziție..."
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Urgență</Label>
                <Select value={formData.urgency} onValueChange={(v) => setFormData({ ...formData, urgency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="foarte_urgent">Foarte Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valoare Estimată (RON)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.estimated_value}
                  onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sursa Buget</Label>
                <Input
                  placeholder="ex: Buget cercetare"
                  value={formData.budget_source}
                  onChange={(e) => setFormData({ ...formData, budget_source: e.target.value })}
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Articole</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Adaugă Articol
                </Button>
              </div>
              
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 p-3 border rounded-lg">
                    <div className="col-span-12 md:col-span-4">
                      <Input
                        placeholder="Denumire articol"
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        placeholder="Cant."
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        placeholder="U.M."
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-3">
                      <Input
                        type="number"
                        placeholder="Preț unitar"
                        value={item.estimatedPrice}
                        onChange={(e) => updateItem(index, 'estimatedPrice', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-1 flex items-center justify-end">
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end p-3 bg-muted rounded-lg">
                <span className="font-medium">
                  Total estimat: {items.reduce((sum, i) => sum + i.quantity * i.estimatedPrice, 0).toLocaleString()} RON
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetForm}>
              Anulează
            </Button>
            <Button variant="secondary" onClick={() => submitRequest(true)} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Salvează Ciornă
            </Button>
            <Button onClick={() => submitRequest(false)} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Trimite spre Aprobare
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Approve Request Dialog */}
      <Dialog open={!!viewingRequest} onOpenChange={() => { setViewingRequest(null); setApprovalNotes(''); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm">{viewingRequest?.request_number}</span>
              {viewingRequest && (
                <Badge variant={statusConfig[viewingRequest.status]?.variant}>
                  {statusConfig[viewingRequest.status]?.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewingRequest && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="font-semibold text-lg">{viewingRequest.title}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">{categoryLabels[viewingRequest.category]}</Badge>
                  <Badge className={urgencyLabels[viewingRequest.urgency]?.color}>
                    {urgencyLabels[viewingRequest.urgency]?.label}
                  </Badge>
                </div>
              </div>

              {viewingRequest.requester && (
                <div className="flex items-center gap-4 text-sm p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{viewingRequest.requester.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    <span>{viewingRequest.department}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground">Descriere</Label>
                <p className="text-sm">{viewingRequest.description}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Justificare</Label>
                <p className="text-sm">{viewingRequest.justification}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Articole</Label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Denumire</th>
                        <th className="text-center p-2">Cant.</th>
                        <th className="text-center p-2">U.M.</th>
                        <th className="text-right p-2">Preț</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingRequest.items as ProcurementItem[]).map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-center">{item.quantity}</td>
                          <td className="p-2 text-center">{item.unit}</td>
                          <td className="p-2 text-right">{item.estimatedPrice.toLocaleString()}</td>
                          <td className="p-2 text-right font-medium">
                            {(item.quantity * item.estimatedPrice).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted">
                      <tr>
                        <td colSpan={4} className="p-2 text-right font-medium">Total:</td>
                        <td className="p-2 text-right font-bold">
                          {viewingRequest.estimated_value.toLocaleString()} {viewingRequest.currency}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Approval section */}
              {canApprove && viewingRequest.status.startsWith('pending') && viewingRequest.user_id !== user?.id && (
                <div className="space-y-3 pt-4 border-t">
                  <Label>Note / Comentarii</Label>
                  <Textarea
                    placeholder="Adăugați note pentru această decizie (opțional)..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      onClick={() => handleApproval(false)}
                      disabled={processing}
                      className="flex-1"
                    >
                      {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Respinge
                    </Button>
                    <Button 
                      onClick={() => handleApproval(true)}
                      disabled={processing}
                      className="flex-1"
                    >
                      {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Aprobă
                    </Button>
                  </div>
                </div>
              )}

              {/* Show rejection reason if rejected */}
              {viewingRequest.status === 'rejected' && viewingRequest.rejection_reason && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <Label className="text-destructive">Motiv respingere:</Label>
                  <p className="text-sm mt-1">{viewingRequest.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Procurement;
