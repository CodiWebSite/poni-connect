import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, HeartPulse, FileText, Bot, ShieldAlert, ShieldCheck, History, Siren, ScrollText, FlaskConical, Megaphone, Settings2 } from 'lucide-react';
import BroadcastNotificationPanel from '@/components/admin/BroadcastNotificationPanel';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import AdminRolesAccessPanel from '@/components/admin/AdminRolesAccessPanel';
import AdminSystemHealth from '@/components/admin/AdminSystemHealth';
import AdminAuditPanel from '@/components/admin/AdminAuditPanel';
import RoleAuditPanel from '@/components/admin/RoleAuditPanel';
import IrisFeedbackPanel from '@/components/admin/IrisFeedbackPanel';
import SecurityDashboard from '@/components/admin/SecurityDashboard';
import SecurityQuizAdminPanel from '@/components/admin/SecurityQuizAdminPanel';
import IncidentsPanel from '@/components/admin/IncidentsPanel';
import GdprPanel from '@/components/admin/GdprPanel';
import LeaveSandboxPanel from '@/components/admin/LeaveSandboxPanel';
import OperationalRulesPanel from '@/components/admin/OperationalRulesPanel';

const TAB_ALIASES: Record<string, { tab: string; sub?: string }> = {
  helpdesk: { tab: 'users', sub: 'helpdesk' },
  conturi: { tab: 'users', sub: 'create' },
  cereri: { tab: 'users', sub: 'requests' },
  utilizatori: { tab: 'users' },
  roluri: { tab: 'roles' },
  audit: { tab: 'audit' },
  'system-health': { tab: 'health' },
  securitate: { tab: 'security' },
  gdpr: { tab: 'gdpr' },
  incidente: { tab: 'incidents' },
};

const Admin = () => {
  const { role, isRealSuperAdmin } = useUserRole();
  const [searchParams] = useSearchParams();

  if (role && !isRealSuperAdmin) return <Navigate to="/" replace />;

  const raw = searchParams.get('tab') || '';
  const mapped = TAB_ALIASES[raw] || (raw ? { tab: raw } : undefined);

  return (
    <MainLayout title="Centru de Control" description="Administrare, monitorizare și audit al platformei ICMPP">
      <Tabs defaultValue={mapped?.tab || 'overview'} className="space-y-6">

        <div className="-mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 w-full justify-start bg-muted/50 backdrop-blur-sm rounded-xl">

            <TabsTrigger value="overview" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <Users className="w-4 h-4" />
              <span>Utilizatori</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <Shield className="w-4 h-4" />
              <span>Roluri & Acces</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <ShieldAlert className="w-4 h-4" />
              <span>Securitate</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <HeartPulse className="w-4 h-4" />
              <span>System Health</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <FileText className="w-4 h-4" />
              <span>Audit</span>
            </TabsTrigger>
            <TabsTrigger value="role-audit" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <History className="w-4 h-4" />
              <span>Audit Roluri</span>
            </TabsTrigger>
            <TabsTrigger value="iris-feedback" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <Bot className="w-4 h-4" />
              <span>IRIS Feedback</span>
            </TabsTrigger>
            <TabsTrigger value="quiz-admin" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <ShieldCheck className="w-4 h-4" />
              <span>Securitate Digitală</span>
            </TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <Siren className="w-4 h-4" />
              <span>Incidente</span>
            </TabsTrigger>
            <TabsTrigger value="gdpr" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <ScrollText className="w-4 h-4" />
              <span>GDPR</span>
            </TabsTrigger>
            <TabsTrigger value="leave-sandbox" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <FlaskConical className="w-4 h-4" />
              <span>Test Concedii</span>
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <Megaphone className="w-4 h-4" />
              <span>Broadcast</span>
            </TabsTrigger>
            <TabsTrigger value="operational-rules" className="text-xs sm:text-sm px-3 py-2 gap-1.5 data-[state=active]:shadow-md rounded-lg">
              <Settings2 className="w-4 h-4" />
              <span>Reguli operaționale</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><AdminOverview /></TabsContent>
        <TabsContent value="users"><AdminUsersPanel /></TabsContent>
        <TabsContent value="roles"><AdminRolesAccessPanel /></TabsContent>
        <TabsContent value="security"><SecurityDashboard /></TabsContent>
        <TabsContent value="health"><AdminSystemHealth /></TabsContent>
        <TabsContent value="audit"><AdminAuditPanel /></TabsContent>
        <TabsContent value="role-audit"><RoleAuditPanel /></TabsContent>
        <TabsContent value="iris-feedback"><IrisFeedbackPanel /></TabsContent>
        <TabsContent value="quiz-admin"><SecurityQuizAdminPanel /></TabsContent>
        <TabsContent value="incidents"><IncidentsPanel /></TabsContent>
        <TabsContent value="gdpr"><GdprPanel /></TabsContent>
        <TabsContent value="leave-sandbox"><LeaveSandboxPanel /></TabsContent>
        <TabsContent value="broadcast"><BroadcastNotificationPanel /></TabsContent>
        <TabsContent value="operational-rules"><OperationalRulesPanel /></TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Admin;
