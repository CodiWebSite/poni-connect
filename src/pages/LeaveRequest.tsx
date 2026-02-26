import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAppSettings } from '@/hooks/useAppSettings';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';
import { LeaveApprovalPanel } from '@/components/leave/LeaveApprovalPanel';
import { LeaveApprovalHistory } from '@/components/leave/LeaveApprovalHistory';
import { LeaveRequestsHR } from '@/components/leave/LeaveRequestsHR';
import { LeaveRequestsList } from '@/components/leave/LeaveRequestsList';
import { FileText, CheckSquare, ClipboardList, Send, History, FlaskConical } from 'lucide-react';

const LeaveRequest = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, role, isSef, isSefSRUS, canManageHR, loading: roleLoading } = useUserRole();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { settings } = useAppSettings();
  const [isDesignatedApprover, setIsDesignatedApprover] = useState(false);

  useEffect(() => {
    if (user) {
      // Check both per-employee and per-department approver mappings
      Promise.all([
        supabase.from('leave_approvers').select('id').eq('approver_user_id', user.id).limit(1),
        supabase.from('leave_department_approvers').select('id').eq('approver_user_id', user.id).limit(1),
      ]).then(([empResult, deptResult]) => {
        setIsDesignatedApprover(
          (empResult.data || []).length > 0 || (deptResult.data || []).length > 0
        );
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
  const canApprove = isDeptHead || isDesignatedApprover;
  const isHR = canManageHR;

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
  const defaultTab = canApprove ? 'approve' : 'new';

  return (
    <MainLayout title="Cereri Concediu de Odihnă" description="Depune și gestionează cererile de concediu">
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
          {/* All employees can submit and see their requests */}
          <TabsTrigger value="new" className="gap-2">
            <Send className="w-4 h-4" />
            Cerere Nouă
          </TabsTrigger>
          <TabsTrigger value="my-requests" className="gap-2">
            <FileText className="w-4 h-4" />
            Cererile Mele
          </TabsTrigger>

          {/* Dept heads and designated approvers can approve */}
          {canApprove && (
            <TabsTrigger value="approve" className="gap-2">
              <CheckSquare className="w-4 h-4" />
              De Aprobat
            </TabsTrigger>
          )}

          {/* Dept heads see their approval history */}
          {canApprove && (
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Centralizator
            </TabsTrigger>
          )}

          {/* HR sees all requests */}
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
