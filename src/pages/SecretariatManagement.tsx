import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { BarChart3, Archive, Bell } from 'lucide-react';
import SecretariatDashboard from '@/components/secretariat/SecretariatDashboard';
import DigitalArchive from '@/components/secretariat/DigitalArchive';
import SecretariatNotifications from '@/components/secretariat/SecretariatNotifications';

const SecretariatManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading } = useUserRole();
  const canManageSecretariat = false;
  const [activeTab, setActiveTab] = useState('dashboard');

  if (authLoading || roleLoading) {
    return (
      <MainLayout title="Gestiune Secretariat">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!canManageSecretariat) {
    return (
      <MainLayout title="Gestiune Secretariat">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nu aveți permisiunea de a accesa această secțiune.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Gestiune Secretariat" 
      description="Rapoarte, arhivă digitală și notificări"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Rapoarte</span>
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Arhivă</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificări</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <SecretariatDashboard />
        </TabsContent>

        <TabsContent value="archive">
          <DigitalArchive />
        </TabsContent>

        <TabsContent value="notifications">
          <SecretariatNotifications />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default SecretariatManagement;
