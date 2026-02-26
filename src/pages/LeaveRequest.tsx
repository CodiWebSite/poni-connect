import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';
import { LeaveApprovalPanel } from '@/components/leave/LeaveApprovalPanel';
import { LeaveApprovalHistory } from '@/components/leave/LeaveApprovalHistory';
import { LeaveRequestsHR } from '@/components/leave/LeaveRequestsHR';
import { LeaveRequestsList } from '@/components/leave/LeaveRequestsList';
import { FileText, CheckSquare, ClipboardList, Send, History } from 'lucide-react';

const LeaveRequest = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, role, isSef, isSefSRUS, canManageHR, loading: roleLoading } = useUserRole();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
  const isHR = canManageHR;

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

  // Default tab based on role
  const defaultTab = isDeptHead ? 'approve' : 'new';

  return (
    <MainLayout title="Cereri Concediu de Odihnă" description="Depune și gestionează cererile de concediu">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {/* All employees can submit and see their requests */}
          <TabsTrigger value="new" className="gap-2">
            <Send className="w-4 h-4" />
            Cerere Nouă
          </TabsTrigger>
          <TabsTrigger value="my-requests" className="gap-2">
            <FileText className="w-4 h-4" />
            Cererile Mele
          </TabsTrigger>

          {/* Dept heads can approve */}
          {isDeptHead && (
            <TabsTrigger value="approve" className="gap-2">
              <CheckSquare className="w-4 h-4" />
              De Aprobat
            </TabsTrigger>
          )}

          {/* Dept heads see their approval history */}
          {isDeptHead && (
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

        {isDeptHead && (
          <TabsContent value="approve">
            <LeaveApprovalPanel onUpdated={handleRefresh} />
          </TabsContent>
        )}

        {isDeptHead && (
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
