import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, Clock, FileText, Calendar, Users, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';

interface PendingItem {
  id: string;
  type: 'document' | 'audience' | 'visitor';
  title: string;
  daysOld: number;
  createdAt: string;
}

const SecretariatNotifications = () => {
  const [notificationSettings, setNotificationSettings] = useState({
    documentReminder: true,
    documentDays: 3,
    audienceReminder: true,
    audienceDays: 1,
    visitorReminder: true
  });

  const { data: pendingDocuments } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_registry')
        .select('id, registration_number, subject, created_at')
        .is('resolved_at', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: upcomingAudiences } = useQuery({
    queryKey: ['upcoming-audiences'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('audiences')
        .select('id, title, scheduled_date, requester_name, status')
        .gte('scheduled_date', today)
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_date', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: todayVisitors } = useQuery({
    queryKey: ['today-visitors'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('visitors')
        .select('id, full_name, host_name, status')
        .eq('expected_date', today)
        .in('status', ['expected', 'checked_in']);
      
      if (error) throw error;
      return data;
    }
  });

  const overdueDocuments = pendingDocuments?.filter(doc => {
    const daysOld = differenceInDays(new Date(), new Date(doc.created_at));
    return daysOld >= notificationSettings.documentDays;
  }) || [];

  const todayAudiences = upcomingAudiences?.filter(a => {
    const audienceDate = format(new Date(a.scheduled_date), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');
    return audienceDate === today;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overdue Documents Alert */}
        <Card className={overdueDocuments.length > 0 ? 'border-amber-500' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${overdueDocuments.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              Documente Întârziate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueDocuments.length}</div>
            <p className="text-xs text-muted-foreground">
              nerezolvate de peste {notificationSettings.documentDays} zile
            </p>
          </CardContent>
        </Card>

        {/* Today's Audiences Alert */}
        <Card className={todayAudiences.length > 0 ? 'border-blue-500' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className={`h-4 w-4 ${todayAudiences.length > 0 ? 'text-blue-500' : 'text-muted-foreground'}`} />
              Audiențe Azi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAudiences.length}</div>
            <p className="text-xs text-muted-foreground">
              programate pentru astăzi
            </p>
          </CardContent>
        </Card>

        {/* Today's Visitors Alert */}
        <Card className={(todayVisitors?.length || 0) > 0 ? 'border-green-500' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className={`h-4 w-4 ${(todayVisitors?.length || 0) > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
              Vizitatori Așteptați
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayVisitors?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              pentru astăzi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Items List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documente ce Necesită Atenție
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueDocuments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nu există documente întârziate
              </p>
            ) : (
              <div className="space-y-3">
                {overdueDocuments.slice(0, 5).map(doc => {
                  const daysOld = differenceInDays(new Date(), new Date(doc.created_at));
                  return (
                    <div key={doc.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-mono text-sm font-medium">{doc.registration_number}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {doc.subject}
                        </div>
                      </div>
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {daysOld} zile
                      </Badge>
                    </div>
                  );
                })}
                {overdueDocuments.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground">
                    + încă {overdueDocuments.length - 5} documente
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Programul de Azi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAudiences.length === 0 && (todayVisitors?.length || 0) === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nu există programări pentru astăzi
              </p>
            ) : (
              <div className="space-y-3">
                {todayAudiences.map(audience => (
                  <div key={audience.id} className="flex items-start justify-between p-3 bg-blue-500/10 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{audience.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {audience.requester_name} • {format(new Date(audience.scheduled_date), 'HH:mm')}
                      </div>
                    </div>
                    <Badge variant={audience.status === 'confirmed' ? 'default' : 'secondary'}>
                      {audience.status === 'confirmed' ? 'Confirmat' : 'În așteptare'}
                    </Badge>
                  </div>
                ))}
                {todayVisitors?.map(visitor => (
                  <div key={visitor.id} className="flex items-start justify-between p-3 bg-green-500/10 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{visitor.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Gazdă: {visitor.host_name}
                      </div>
                    </div>
                    <Badge variant={visitor.status === 'checked_in' ? 'default' : 'outline'}>
                      {visitor.status === 'checked_in' ? 'Înregistrat' : 'Așteptat'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Setări Notificări
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alertă documente întârziate</Label>
              <p className="text-sm text-muted-foreground">
                Afișează alerte pentru documente nerezolvate
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Select 
                value={String(notificationSettings.documentDays)}
                onValueChange={(v) => setNotificationSettings({ ...notificationSettings, documentDays: parseInt(v) })}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 zi</SelectItem>
                  <SelectItem value="2">2 zile</SelectItem>
                  <SelectItem value="3">3 zile</SelectItem>
                  <SelectItem value="5">5 zile</SelectItem>
                  <SelectItem value="7">7 zile</SelectItem>
                </SelectContent>
              </Select>
              <Switch
                checked={notificationSettings.documentReminder}
                onCheckedChange={(v) => setNotificationSettings({ ...notificationSettings, documentReminder: v })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alertă audiențe aproape</Label>
              <p className="text-sm text-muted-foreground">
                Afișează audiențele din următoarele zile
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Select 
                value={String(notificationSettings.audienceDays)}
                onValueChange={(v) => setNotificationSettings({ ...notificationSettings, audienceDays: parseInt(v) })}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Azi</SelectItem>
                  <SelectItem value="2">2 zile</SelectItem>
                  <SelectItem value="3">3 zile</SelectItem>
                  <SelectItem value="7">7 zile</SelectItem>
                </SelectContent>
              </Select>
              <Switch
                checked={notificationSettings.audienceReminder}
                onCheckedChange={(v) => setNotificationSettings({ ...notificationSettings, audienceReminder: v })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alertă vizitatori</Label>
              <p className="text-sm text-muted-foreground">
                Afișează vizitatorii așteptați pentru ziua curentă
              </p>
            </div>
            <Switch
              checked={notificationSettings.visitorReminder}
              onCheckedChange={(v) => setNotificationSettings({ ...notificationSettings, visitorReminder: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecretariatNotifications;
