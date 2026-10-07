import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, GitBranch, Route, Bell, Tag, Megaphone, CalendarDays, Eye } from 'lucide-react';
import AccessMatrixEditor from './AccessMatrixEditor';
import ApprovalWorkflowEditor from './ApprovalWorkflowEditor';
import RequestRoutingEditor from './RequestRoutingEditor';
import NotificationRulesEditor from './NotificationRulesEditor';
import CustomRolesManager from './CustomRolesManager';
import AnnouncementPublishersPanel from './AnnouncementPublishersPanel';
import EventPublishersPanel from './EventPublishersPanel';

const AdminRolesAccessPanel = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Roluri & Acces</h2>
        <p className="text-sm text-muted-foreground">Gestionează roluri, permisiuni și reguli operaționale</p>
      </div>

      <Tabs defaultValue="matrix" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="matrix" className="text-xs gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Matrice Acces
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-xs gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Roluri Custom
          </TabsTrigger>
          <TabsTrigger value="workflows" className="text-xs gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            Fluxuri Aprobare
          </TabsTrigger>
          <TabsTrigger value="routing" className="text-xs gap-1.5">
            <Route className="w-3.5 h-3.5" />
            Rutare Cereri
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Notificări
          </TabsTrigger>
          <TabsTrigger value="announcement-publishers" className="text-xs gap-1.5">
            <Megaphone className="w-3.5 h-3.5" />
            Editori Anunțuri
          </TabsTrigger>
          <TabsTrigger value="event-publishers" className="text-xs gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Editori Evenimente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix"><AccessMatrixEditor /></TabsContent>
        <TabsContent value="roles"><CustomRolesManager /></TabsContent>
        <TabsContent value="workflows"><ApprovalWorkflowEditor /></TabsContent>
        <TabsContent value="routing"><RequestRoutingEditor /></TabsContent>
        <TabsContent value="notifications"><NotificationRulesEditor /></TabsContent>
        <TabsContent value="announcement-publishers"><AnnouncementPublishersPanel /></TabsContent>
        <TabsContent value="event-publishers"><EventPublishersPanel /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminRolesAccessPanel;
