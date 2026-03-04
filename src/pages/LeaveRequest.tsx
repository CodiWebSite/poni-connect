import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';
import { LeaveApprovalPanel } from '@/components/leave/LeaveApprovalPanel';
import { LeaveApprovalHistory } from '@/components/leave/LeaveApprovalHistory';
import { LeaveRequestsHR } from '@/components/leave/LeaveRequestsHR';
import { LeaveRequestsList } from '@/components/leave/LeaveRequestsList';
import { LeaveApprovalDelegate } from '@/components/leave/LeaveApprovalDelegate';
import { FileText, CheckSquare, ClipboardList, Send, History, FlaskConical, UserCheck, Bug, Eye } from 'lucide-react';
import ContextualHelp from '@/components/shared/ContextualHelp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

type SimulatedRole = 'none' | 'angajat' | 'sef_departament' | 'hr_srus' | 'full';

const ROLE_LABELS: Record<SimulatedRole, string> = {
  none: 'Fără simulare (rolul tău real)',
  angajat: '👤 Angajat simplu',
  sef_departament: '🏢 Șef Departament',
  hr_srus: '📋 HR / SRUS',
  full: '⭐ Toate tab-urile (Super Admin)',
};

const LeaveRequest = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, role, isSef, isSefSRUS, canManageHR, loading: roleLoading } = useUserRole();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { settings } = useAppSettings();
  const { isDemo } = useDemoMode();
  const [isDesignatedApprover, setIsDesignatedApprover] = useState(false);
  const [isActiveDelegate, setIsActiveDelegate] = useState(false);
  const [simulatedRole, setSimulatedRole] = useState<SimulatedRole>('none');

  useEffect(() => {
    if (user) {
      Promise.all([
        supabase.from('leave_approvers').select('id').eq('approver_user_id', user.id).limit(1),
        supabase.from('leave_department_approvers').select('id').eq('approver_user_id', user.id).limit(1),
      ]).then(([empResult, deptResult]) => {
        setIsDesignatedApprover(
          (empResult.data || []).length > 0 || (deptResult.data || []).length > 0
        );
      });

      const today = new Date().toISOString().split('T')[0];
      supabase
        .from('leave_approval_delegates' as any)
        .select('id')
        .eq('delegate_user_id', user.id)
        .eq('is_active', true)
        .lte('start_date', today)
        .gte('end_date', today)
        .limit(1)
        .then(({ data }) => {
          setIsActiveDelegate((data || []).length > 0);
        });
    }
  }, [user]);

  if (authLoading || roleLoading) {
    return (
      <MainLayout title="Cereri Concediu">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const isDeptHead = isSef || isSefSRUS || isSuperAdmin;
  const realCanApprove = isDeptHead || isDesignatedApprover || isActiveDelegate;
  const realIsHR = canManageHR;

  // Compute effective permissions based on simulation
  let canApprove = realCanApprove;
  let isHR = realIsHR;

  if ((isSuperAdmin || canManageHR) && simulatedRole !== 'none') {
    switch (simulatedRole) {
      case 'angajat':
        canApprove = false;
        isHR = false;
        break;
      case 'sef_departament':
        canApprove = true;
        isHR = false;
        break;
      case 'hr_srus':
        canApprove = false;
        isHR = true;
        break;
      case 'full':
        canApprove = true;
        isHR = true;
        break;
    }
  }

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
  const defaultTab = canApprove ? 'approve' : 'new';

  return (
    <MainLayout title="Cereri Concediu de Odihnă" description={<span className="inline-flex items-center gap-1">Depune și gestionează cererile de concediu <ContextualHelp title="Cerere de Concediu" content="Completați formularul, semnați electronic și trimiteți cererea." steps={['Completați perioada și înlocuitorul', 'Semnați cererea electronic', 'Așteptați aprobarea: Șef → SRUS → Aprobat']} /></span>}>
      
      {/* Debug Sandbox Panel - only for Super Admin */}
      {(isSuperAdmin || canManageHR) && isDemo && (
        <Card className="mb-4 border-2 border-dashed border-purple-400/60 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-500/40">
          <CardContent className="py-3 px-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Bug className="w-4 h-4" />
                <span className="text-sm font-semibold">Sandbox Test</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <Select value={simulatedRole} onValueChange={(v) => setSimulatedRole(v as SimulatedRole)}>
                  <SelectTrigger className="w-[280px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_LABELS) as [SimulatedRole, string][]).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {simulatedRole !== 'none' && (
                <Badge className="bg-purple-600 text-white text-[10px]">
                  Simulare activă: {ROLE_LABELS[simulatedRole]}
                </Badge>
              )}
            </div>
            <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-2">
              Vizualizează interfața din perspectiva diferitelor roluri. Datele rămân reale — doar tab-urile vizibile se schimbă.
            </p>
          </CardContent>
        </Card>
      )}

      {settings.leave_module_beta && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50/70 dark:border-amber-600/40 dark:bg-amber-950/30 px-4 py-2.5">
          <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Beta</strong> — Modulul de cereri de concediu este în faza de testare. Dacă întâmpinați probleme, contactați departamentul IT.
          </p>
          <Badge variant="outline" className="ml-auto text-[10px] border-amber-400 text-amber-600 dark:text-amber-400 flex-shrink-0">
            v0.9
          </Badge>
        </div>
      )}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="new" className="gap-2">
            <Send className="w-4 h-4" />
            Cerere Nouă
          </TabsTrigger>
          <TabsTrigger value="my-requests" className="gap-2">
            <FileText className="w-4 h-4" />
            Cererile Mele
          </TabsTrigger>

          {canApprove && (
            <TabsTrigger value="approve" className="gap-2">
              <CheckSquare className="w-4 h-4" />
              De Aprobat
            </TabsTrigger>
          )}

          {canApprove && (
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Centralizator
            </TabsTrigger>
          )}

          {canApprove && (
            <TabsTrigger value="delegate" className="gap-2">
              <UserCheck className="w-4 h-4" />
              Înlocuitor
            </TabsTrigger>
          )}

          {isHR && (
            <TabsTrigger value="hr" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Centralizare HR
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="new">
          <LeaveRequestForm onSubmitted={handleRefresh} />
        </TabsContent>

        <TabsContent value="my-requests">
          <LeaveRequestsList refreshTrigger={refreshTrigger} />
        </TabsContent>

        {canApprove && (
          <TabsContent value="approve">
            <LeaveApprovalPanel onUpdated={handleRefresh} />
          </TabsContent>
        )}

        {canApprove && (
          <TabsContent value="history">
            <LeaveApprovalHistory refreshTrigger={refreshTrigger} />
          </TabsContent>
        )}

        {canApprove && (
          <TabsContent value="delegate">
            <LeaveApprovalDelegate />
          </TabsContent>
        )}

        {isHR && (
          <TabsContent value="hr">
            <LeaveRequestsHR refreshTrigger={refreshTrigger} />
          </TabsContent>
        )}
      </Tabs>
    </MainLayout>
  );
};

export default LeaveRequest;
