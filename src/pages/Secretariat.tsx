import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { FileText, Calendar, Users } from 'lucide-react';
import DocumentRegistry from '@/components/secretariat/DocumentRegistry';
import AudienceScheduler from '@/components/secretariat/AudienceScheduler';
import VisitorLog from '@/components/secretariat/VisitorLog';

const Secretariat = () => {
  const { user, loading: authLoading } = useAuth();
  const { canManageSecretariat, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('registry');

  if (authLoading || roleLoading) {
    return (
      <MainLayout title="Secretariat">
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
      <MainLayout title="Secretariat">
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
      title="Secretariat" 
      description="Registratură, programări audiențe și evidență vizitatori"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="registry" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Registratură</span>
          </TabsTrigger>
          <TabsTrigger value="audiences" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Audiențe</span>
          </TabsTrigger>
          <TabsTrigger value="visitors" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Vizitatori</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registry">
          <DocumentRegistry />
        </TabsContent>

        <TabsContent value="audiences">
          <AudienceScheduler />
        </TabsContent>

        <TabsContent value="visitors">
          <VisitorLog />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Secretariat;
