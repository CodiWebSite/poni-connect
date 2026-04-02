import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, HeartPulse, FileText, Bot } from 'lucide-react';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import AdminRolesAccessPanel from '@/components/admin/AdminRolesAccessPanel';
import AdminSystemHealth from '@/components/admin/AdminSystemHealth';
import AdminAuditPanel from '@/components/admin/AdminAuditPanel';
import IrisFeedbackPanel from '@/components/admin/IrisFeedbackPanel';

const Admin = () => {
  const { role, isRealSuperAdmin } = useUserRole();

  if (role && !isRealSuperAdmin) return <Navigate to="/" replace />;

  return (
    <MainLayout title="Centru de Control" description="Administrare, monitorizare și audit al platformei ICMPP">
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide">
          <TabsList className="inline-flex md:flex h-12 gap-1 p-1.5 min-w-max md:min-w-0 bg-muted/50 backdrop-blur-sm rounded-xl">
            <TabsTrigger value="overview" className="text-sm px-4 gap-2 data-[state=active]:shadow-md rounded-lg">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-sm px-4 gap-2 data-[state=active]:shadow-md rounded-lg">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Utilizatori</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-sm px-4 gap-2 data-[state=active]:shadow-md rounded-lg">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Roluri & Acces</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="text-sm px-4 gap-2 data-[state=active]:shadow-md rounded-lg">
              <HeartPulse className="w-4 h-4" />
              <span className="hidden sm:inline">System Health</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-sm px-4 gap-2 data-[state=active]:shadow-md rounded-lg">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="iris-feedback" className="text-sm px-4 gap-2 data-[state=active]:shadow-md rounded-lg">
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">IRIS Feedback</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><AdminOverview /></TabsContent>
        <TabsContent value="users"><AdminUsersPanel /></TabsContent>
        <TabsContent value="roles"><AdminRolesAccessPanel /></TabsContent>
        <TabsContent value="health"><AdminSystemHealth /></TabsContent>
        <TabsContent value="audit"><AdminAuditPanel /></TabsContent>
        <TabsContent value="iris-feedback"><IrisFeedbackPanel /></TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Admin;
