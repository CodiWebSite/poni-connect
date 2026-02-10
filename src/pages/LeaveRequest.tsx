import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';
import { LeaveApprovalPanel } from '@/components/leave/LeaveApprovalPanel';
import { LeaveRequestsHR } from '@/components/leave/LeaveRequestsHR';
import { LeaveRequestsList } from '@/components/leave/LeaveRequestsList';
import { FileText, CheckSquare, ClipboardList, Send } from 'lucide-react';

const LeaveRequest = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, role, loading: roleLoading } = useUserRole();
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

  // In testing phase - only super_admin
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const isDirector = role === 'director_institut' || role === 'director_adjunct';
  const isDeptHead = role === 'sef' || role === 'sef_srus';
  const canApprove = isDirector || isDeptHead;

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

  return (
    <MainLayout title="Cereri Concediu de Odihnă" description="Depune și gestionează cererile de concediu">
        <Tabs defaultValue="new" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
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
            {isSuperAdmin && (
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

          {isSuperAdmin && (
            <TabsContent value="hr">
              <LeaveRequestsHR refreshTrigger={refreshTrigger} />
            </TabsContent>
          )}
        </Tabs>
    </MainLayout>
  );
};

export default LeaveRequest;
