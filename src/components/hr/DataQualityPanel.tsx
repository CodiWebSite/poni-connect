import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, Mail, UserX, FileWarning, Shield, Copy, Briefcase, Building2, Users } from 'lucide-react';

interface QualityIssue {
  label: string;
  icon: any;
  severity: 'critical' | 'warning' | 'info';
  items: { name: string; detail: string }[];
}

export default function DataQualityPanel() {
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    setLoading(true);
    const { data: employees } = await supabase.from('employee_personal_data').select('id, first_name, last_name, email, cnp, department, position, ci_series, ci_number, employee_record_id').eq('is_archived', false);

    const emps = employees || [];
    const qualityIssues: QualityIssue[] = [];

    // Email invalid
    const invalidEmail = emps.filter(e => e.email.endsWith('@fara-email.local'));
    if (invalidEmail.length > 0) qualityIssues.push({
      label: 'Angajați fără email valid', icon: Mail, severity: 'warning',
      items: invalidEmail.map(e => ({ name: `${e.last_name} ${e.first_name}`, detail: e.email })),
    });

    // Missing department
    const noDept = emps.filter(e => !e.department);
    if (noDept.length > 0) qualityIssues.push({
      label: 'Departament lipsă', icon: Building2, severity: 'warning',
      items: noDept.map(e => ({ name: `${e.last_name} ${e.first_name}`, detail: e.email })),
    });

    // Missing position
    const noPos = emps.filter(e => !e.position);
    if (noPos.length > 0) qualityIssues.push({
      label: 'Funcție lipsă', icon: Briefcase, severity: 'warning',
      items: noPos.map(e => ({ name: `${e.last_name} ${e.first_name}`, detail: e.department || 'Fără dept.' })),
    });

    // Missing CI data
    const noCI = emps.filter(e => !e.ci_series || !e.ci_number);
    if (noCI.length > 0) qualityIssues.push({
      label: 'Date CI lipsă', icon: FileWarning, severity: 'warning',
      items: noCI.map(e => ({ name: `${e.last_name} ${e.first_name}`, detail: !e.ci_series ? 'Serie lipsă' : 'Număr lipsă' })),
    });

    // Missing CNP
    const noCNP = emps.filter(e => !e.cnp || e.cnp.length !== 13);
    if (noCNP.length > 0) qualityIssues.push({
      label: 'CNP lipsă sau invalid', icon: Shield, severity: 'critical',
      items: noCNP.map(e => ({ name: `${e.last_name} ${e.first_name}`, detail: e.cnp ? `CNP: ${e.cnp} (${e.cnp.length} cifre)` : 'CNP lipsă' })),
    });

    // Duplicate CNP
    const cnpMap = new Map<string, string[]>();
    emps.forEach(e => {
      if (e.cnp && e.cnp.length === 13) {
        const list = cnpMap.get(e.cnp) || [];
        list.push(`${e.last_name} ${e.first_name}`);
        cnpMap.set(e.cnp, list);
      }
    });
    const dupes = Array.from(cnpMap.entries()).filter(([, names]) => names.length > 1);
    if (dupes.length > 0) qualityIssues.push({
      label: 'Duplicate CNP', icon: Copy, severity: 'critical',
      items: dupes.map(([cnp, names]) => ({ name: names.join(', '), detail: `CNP: ${cnp}` })),
    });

    // Without account
    const noAccount = emps.filter(e => !e.employee_record_id);
    if (noAccount.length > 0) qualityIssues.push({
      label: 'Angajați fără cont platformă', icon: UserX, severity: 'info',
      items: noAccount.map(e => ({ name: `${e.last_name} ${e.first_name}`, detail: e.email })),
    });

    setIssues(qualityIssues);
    setLoading(false);
  };

  const severityColors = {
    critical: 'text-destructive border-destructive/30 bg-destructive/5',
    warning: 'text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/5',
    info: 'text-blue-700 dark:text-blue-400 border-blue-500/30 bg-blue-500/5',
  };

  const severityBadge = {
    critical: 'bg-destructive text-destructive-foreground',
    warning: 'bg-amber-500 text-white',
    info: 'bg-blue-500 text-white',
  };

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className="font-semibold text-lg">Toate datele sunt corecte!</p>
          <p className="text-sm text-muted-foreground mt-1">Nu au fost detectate probleme de calitate.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold">Audit Calitate Date</h3>
        <Badge variant="secondary">{issues.reduce((acc, i) => acc + i.items.length, 0)} probleme detectate</Badge>
      </div>

      {issues.map((issue, idx) => (
        <Collapsible key={idx}>
          <CollapsibleTrigger asChild>
            <Card className={`cursor-pointer border ${severityColors[issue.severity]} hover:shadow-card-hover transition-all`}>
              <CardContent className="p-4 flex items-center gap-3">
                <issue.icon className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{issue.label}</p>
                </div>
                <Badge className={severityBadge[issue.severity]}>{issue.items.length}</Badge>
                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
              </CardContent>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 ml-4 border-l-2 border-border pl-4 space-y-1 py-2">
              {issue.items.slice(0, 20).map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">— {item.detail}</span>
                </div>
              ))}
              {issue.items.length > 20 && <p className="text-xs text-muted-foreground">...și încă {issue.items.length - 20}</p>}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
