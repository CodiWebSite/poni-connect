import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';
import { LeaveApprovalPanel } from '@/components/leave/LeaveApprovalPanel';
import { LeaveRequestsHR } from '@/components/leave/LeaveRequestsHR';
import { LeaveRequestsList } from '@/components/leave/LeaveRequestsList';
import { FileText, CheckSquare, ClipboardList, Send, Bug, User, Shield, Briefcase } from 'lucide-react';

type DebugPerspective = 'self' | 'director' | 'sef' | 'hr';

const perspectiveLabels: Record<DebugPerspective, string> = {
  self: 'Angajat (eu)',
  director: 'Director',
  sef: 'Șef Compartiment',
  hr: 'HR / Super Admin',
};

const perspectiveIcons: Record<DebugPerspective, typeof User> = {
  self: User,
  director: Shield,
  sef: Briefcase,
  hr: ClipboardList,
};

const perspectiveColors: Record<DebugPerspective, string> = {
  self: 'bg-muted text-foreground',
  director: 'bg-indigo-600 text-white hover:bg-indigo-700',
  sef: 'bg-amber-600 text-white hover:bg-amber-700',
  hr: 'bg-purple-600 text-white hover:bg-purple-700',
};

const LeaveRequest = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, role, loading: roleLoading } = useUserRole();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [debugPerspective, setDebugPerspective] = useState<DebugPerspective>('self');

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
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  // Determine effective role based on debug perspective
  const effectiveIsDirector = debugPerspective === 'director' || role === 'director_institut' || role === 'director_adjunct';
  const effectiveIsDeptHead = debugPerspective === 'sef' || role === 'sef' || role === 'sef_srus';
  const effectiveIsHR = debugPerspective === 'hr' || isSuperAdmin;

  // Determine which tabs to show based on perspective
  const showEmployeeTabs = debugPerspective === 'self';
  const showApprovalTab = debugPerspective === 'director' || debugPerspective === 'sef';
  const showHRTab = debugPerspective === 'hr';
  // Always show all tabs (Super Admin can see everything)
  const showAllTabs = true;

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

  const defaultTab = debugPerspective === 'director' || debugPerspective === 'sef' 
    ? 'approve' 
    : debugPerspective === 'hr' 
      ? 'hr' 
      : 'new';

  return (
    <MainLayout title="Cereri Concediu de Odihnă" description="Depune și gestionează cererile de concediu">
      {/* Debug Panel - only for Super Admin */}
      <Card className="mb-6 border-dashed border-2 border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Bug className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Debug Panel – Simulare Perspectivă
            </span>
            <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
              Super Admin Only
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(perspectiveLabels) as DebugPerspective[]).map(p => {
              const Icon = perspectiveIcons[p];
              const isActive = debugPerspective === p;
              return (
                <Button
                  key={p}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className={isActive ? perspectiveColors[p] : ''}
                  onClick={() => setDebugPerspective(p)}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {perspectiveLabels[p]}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {debugPerspective === 'self' && 'Vizualizezi ca angajat obișnuit: poți depune cereri și vedea lista ta.'}
            {debugPerspective === 'director' && 'Vizualizezi ca Director: poți aproba/respinge cererile în așteptare (pending_director).'}
            {debugPerspective === 'sef' && 'Vizualizezi ca Șef Compartiment: poți aproba/respinge cererile aprobate de director (pending_department_head).'}
            {debugPerspective === 'hr' && 'Vizualizezi ca HR: vezi toate cererile centralizat, poți descărca documente.'}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab} key={debugPerspective} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {(showEmployeeTabs || showAllTabs) && (
            <>
              <TabsTrigger value="new" className="gap-2">
                <Send className="w-4 h-4" />
                Cerere Nouă
              </TabsTrigger>
              <TabsTrigger value="my-requests" className="gap-2">
                <FileText className="w-4 h-4" />
                Cererile Mele
              </TabsTrigger>
            </>
          )}
          {(showApprovalTab || showAllTabs) && (
            <TabsTrigger value="approve" className="gap-2">
              <CheckSquare className="w-4 h-4" />
              De Aprobat
              {(debugPerspective === 'director' || debugPerspective === 'sef') && (
                <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-amber-500 text-white">
                  {debugPerspective === 'director' ? 'Director' : 'Șef'}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {(showHRTab || showAllTabs) && (
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

        <TabsContent value="approve">
          <LeaveApprovalPanel 
            onUpdated={handleRefresh} 
            debugPerspective={debugPerspective === 'director' ? 'director' : debugPerspective === 'sef' ? 'sef' : undefined}
          />
        </TabsContent>

        <TabsContent value="hr">
          <LeaveRequestsHR refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default LeaveRequest;
