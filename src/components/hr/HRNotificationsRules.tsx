import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, ArrowRight, FileText, AlertTriangle, Stethoscope, ShieldAlert, Clock } from 'lucide-react';

interface NotificationRule {
  trigger: string;
  target: string;
  targetLabel: string;
  type: 'in_app' | 'email' | 'dashboard';
  icon: any;
  severity: 'info' | 'warning' | 'critical';
}

const rules: NotificationRule[] = [
  { trigger: 'Cerere corecție date personale', target: 'hr', targetLabel: 'HR', type: 'in_app', icon: FileText, severity: 'info' },
  { trigger: 'Cerere adeverință', target: 'hr', targetLabel: 'HR', type: 'in_app', icon: FileText, severity: 'info' },
  { trigger: 'Expirare fișă medicală', target: 'medic_medicina_muncii', targetLabel: 'Medic Medicina Muncii', type: 'dashboard', icon: Stethoscope, severity: 'critical' },
  { trigger: 'Document CI expirat', target: 'hr', targetLabel: 'HR Dashboard', type: 'dashboard', icon: ShieldAlert, severity: 'critical' },
  { trigger: 'Document CI expiră în 30 zile', target: 'hr', targetLabel: 'HR Dashboard', type: 'dashboard', icon: AlertTriangle, severity: 'warning' },
  { trigger: 'Document lipsă angajat', target: 'hr', targetLabel: 'HR Dashboard', type: 'dashboard', icon: Clock, severity: 'warning' },
];

const severityColors = {
  info: 'border-blue-500/30 bg-blue-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-destructive/30 bg-destructive/5',
};

const typeBadge = {
  in_app: <Badge variant="secondary" className="text-[10px]">In-App</Badge>,
  email: <Badge variant="secondary" className="text-[10px]">Email</Badge>,
  dashboard: <Badge variant="secondary" className="text-[10px]">Dashboard</Badge>,
};

export default function HRNotificationsRules() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />Reguli de Notificare HR</CardTitle>
          <CardDescription>Rutarea automată a alertelor și notificărilor către rolurile responsabile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.map((rule, i) => (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border ${severityColors[rule.severity]} transition-all`}>
              <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-sm flex-shrink-0">
                <rule.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{rule.trigger}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className="bg-primary text-primary-foreground text-xs">{rule.targetLabel}</Badge>
                {typeBadge[rule.type]}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informații Rutare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• <strong>Corecții date personale</strong> → rutate automat către rolul <Badge variant="outline" className="text-xs">HR</Badge></p>
          <p>• <strong>Adeverințe</strong> → rutate automat către rolul <Badge variant="outline" className="text-xs">HR</Badge></p>
          <p>• <strong>Expirări fișe medicale</strong> → notificare pentru <Badge variant="outline" className="text-xs">Medic Medicina Muncii</Badge></p>
          <p>• <strong>super_admin</strong> are vizibilitate completă asupra tuturor alertelor</p>
          <p>• <strong>sef_srus</strong> poate administra integral modulul HR</p>
        </CardContent>
      </Card>
    </div>
  );
}
