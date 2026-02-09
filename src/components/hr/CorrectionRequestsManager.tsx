import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  MessageSquare,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const fieldLabels: Record<string, string> = {
  full_name: 'Nume complet',
  department: 'Departament',
  position: 'Funcție',
  email: 'Email',
  phone: 'Telefon',
  cnp: 'CNP',
  address: 'Adresă',
  ci: 'Carte de Identitate',
  hire_date: 'Data angajării',
  contract_type: 'Tip contract',
  leave_days: 'Zile concediu',
  other: 'Altele',
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: any }> = {
  pending: { label: 'În așteptare', variant: 'secondary', icon: Clock },
  approved: { label: 'Aprobat', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Respins', variant: 'destructive', icon: XCircle },
};

interface CorrectionRequest {
  id: string;
  user_id: string;
  field_name: string;
  current_value: string | null;
  requested_value: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface ProfileInfo {
  full_name: string;
  department: string | null;
}

export const CorrectionRequestsManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<(CorrectionRequest & { profile?: ProfileInfo })[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [showResolveDialog, setShowResolveDialog] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('data_correction_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching correction requests:', error);
      setLoading(false);
      return;
    }

    // Fetch profile info for each unique user_id
    const userIds = [...new Set((data || []).map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, department')
      .in('user_id', userIds);

    const profileMap = new Map<string, ProfileInfo>();
    profiles?.forEach(p => profileMap.set(p.user_id, { full_name: p.full_name, department: p.department }));

    const enriched = (data || []).map(r => ({
      ...r,
      profile: profileMap.get(r.user_id),
    }));

    setRequests(enriched);
    setLoading(false);
  };

  const resolveRequest = async (id: string, status: 'approved' | 'rejected') => {
    if (!user) return;
    setResolving(id);

    const { error } = await supabase
      .from('data_correction_requests')
      .update({
        status,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        admin_notes: adminNotes.trim() || null,
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut actualiza cererea.', variant: 'destructive' });
    } else {
      toast({ 
        title: status === 'approved' ? 'Cerere aprobată' : 'Cerere respinsă', 
        description: status === 'approved' 
          ? 'Nu uitați să actualizați datele angajatului din secțiunea Date Personale.' 
          : 'Angajatul va fi notificat.'
      });
      fetchRequests();
    }

    setResolving(null);
    setShowResolveDialog(null);
    setAdminNotes('');
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{pendingCount}</strong> {pendingCount === 1 ? 'cerere nouă' : 'cereri noi'} de corecție în așteptare
          </p>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nu există cereri de corecție.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const config = statusConfig[req.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            
            return (
              <div key={req.id} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{req.profile?.full_name || 'Angajat necunoscut'}</p>
                      {req.profile?.department && (
                        <span className="text-xs text-muted-foreground">({req.profile.department})</span>
                      )}
                      <Badge variant={config.variant} className="text-xs gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                    </div>

                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Câmp: </span>
                        <span className="font-medium">{fieldLabels[req.field_name] || req.field_name}</span>
                      </p>
                      {req.current_value && (
                        <p>
                          <span className="text-muted-foreground">Valoare curentă: </span>
                          <span className="line-through text-muted-foreground">{req.current_value}</span>
                        </p>
                      )}
                      <p>
                        <span className="text-muted-foreground">Valoare solicitată: </span>
                        <span className="font-medium text-primary">{req.requested_value}</span>
                      </p>
                      {req.reason && (
                        <p className="text-muted-foreground italic text-xs mt-1">
                          Motiv: {req.reason}
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {format(new Date(req.created_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
                    </p>

                    {req.admin_notes && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <span className="font-medium">Răspuns HR: </span>{req.admin_notes}
                      </div>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-primary border-primary/30 hover:bg-primary/10"
                        onClick={() => {
                          setShowResolveDialog({ id: req.id, action: 'approved' });
                          setAdminNotes('');
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Aprobă
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => {
                          setShowResolveDialog({ id: req.id, action: 'rejected' });
                          setAdminNotes('');
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Respinge
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={!!showResolveDialog} onOpenChange={(open) => !open && setShowResolveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {showResolveDialog?.action === 'approved' ? 'Aprobă Cererea' : 'Respinge Cererea'}
            </DialogTitle>
            <DialogDescription>
              {showResolveDialog?.action === 'approved' 
                ? 'Aprobați cererea și actualizați manual datele angajatului.'
                : 'Respingeți cererea cu un motiv.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notă pentru angajat (opțional)</label>
              <Textarea 
                placeholder="ex: Am corectat datele conform cererii..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(null)}>Anulează</Button>
            <Button
              variant={showResolveDialog?.action === 'rejected' ? 'destructive' : 'default'}
              disabled={!!resolving}
              onClick={() => showResolveDialog && resolveRequest(showResolveDialog.id, showResolveDialog.action)}
            >
              {resolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {showResolveDialog?.action === 'approved' ? 'Aprobă' : 'Respinge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
