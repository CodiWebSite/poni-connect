import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Activity } from 'lucide-react';
import AuditLog from './AuditLog';
import AuthLoginLog from './AuthLoginLog';

const AdminAuditPanel = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Audit & Istoric</h2>
        <p className="text-sm text-muted-foreground">Jurnal complet al acțiunilor și autentificărilor</p>
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="audit" className="text-xs gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Jurnal Acțiuni
          </TabsTrigger>
          <TabsTrigger value="auth" className="text-xs gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Autentificări
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit"><AuditLog /></TabsContent>
        <TabsContent value="auth"><AuthLoginLog /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAuditPanel;
