import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, GitBranch, Route, Bell, Tag } from 'lucide-react';
import AccessMatrixEditor from './AccessMatrixEditor';
import ApprovalWorkflowEditor from './ApprovalWorkflowEditor';
import RequestRoutingEditor from './RequestRoutingEditor';
import NotificationRulesEditor from './NotificationRulesEditor';
import CustomRolesManager from './CustomRolesManager';

const OperationalRulesPanel = () => {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="roles" className="text-xs gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Roluri Custom
          </TabsTrigger>
          <TabsTrigger value="access" className="text-xs gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Acces Pagini
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
        </TabsList>

        <TabsContent value="roles">
          <CustomRolesManager />
        </TabsContent>
        <TabsContent value="access">
          <AccessMatrixEditor />
        </TabsContent>
        <TabsContent value="workflows">
          <ApprovalWorkflowEditor />
        </TabsContent>
        <TabsContent value="routing">
          <RequestRoutingEditor />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationRulesEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperationalRulesPanel;
