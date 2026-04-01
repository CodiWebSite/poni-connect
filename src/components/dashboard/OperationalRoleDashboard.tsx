import MainLayout from '@/components/layout/MainLayout';
import DashboardAlertsBanner from './DashboardAlertsBanner';
import DashboardGreeting from './DashboardGreeting';
import QuickActionsGrid, { QuickAction } from './QuickActionsGrid';
import DashboardAnnouncements from './DashboardAnnouncements';
import ActivityHistory from './ActivityHistory';
import ChangelogWidget from './ChangelogWidget';
import PersonalLeaveWidget from './PersonalLeaveWidget';
import {
  UserCircle, Calendar, FolderDown, BookOpen, DollarSign, FileText,
  ShoppingCart, Scale, Megaphone, Mail, LucideIcon,
} from 'lucide-react';
import { AppRole } from '@/hooks/useUserRole';

interface OperationalRoleDashboardProps {
  role: AppRole | null;
}

const roleConfig: Record<string, { title: string; subtitle: string; moduleAction: QuickAction }> = {
  bibliotecar: {
    title: 'Dashboard Bibliotecă',
    subtitle: 'Gestiune bibliotecă',
    moduleAction: { icon: BookOpen, label: 'Bibliotecă', path: '/library', gradient: 'from-primary to-info' },
  },
  salarizare: {
    title: 'Dashboard Salarizare',
    subtitle: 'Centru salarizare',
    moduleAction: { icon: DollarSign, label: 'Salarizare', path: '/salarizare', gradient: 'from-accent to-success' },
  },
  secretariat: {
    title: 'Dashboard Secretariat',
    subtitle: 'Centru secretariat',
    moduleAction: { icon: Mail, label: 'Secretariat', path: '/formulare', gradient: 'from-info to-primary' },
  },
  achizitii: {
    title: 'Dashboard Achiziții',
    subtitle: 'Centru achiziții',
    moduleAction: { icon: ShoppingCart, label: 'Achiziții', path: '/formulare', gradient: 'from-warning to-destructive' },
  },
  contabilitate: {
    title: 'Dashboard Contabilitate',
    subtitle: 'Centru contabilitate',
    moduleAction: { icon: FileText, label: 'Contabilitate', path: '/formulare', gradient: 'from-primary to-info' },
  },
  oficiu_juridic: {
    title: 'Dashboard Juridic',
    subtitle: 'Oficiu juridic',
    moduleAction: { icon: Scale, label: 'Juridic', path: '/formulare', gradient: 'from-accent to-success' },
  },
  compartiment_comunicare: {
    title: 'Dashboard Comunicare',
    subtitle: 'Compartiment comunicare',
    moduleAction: { icon: Megaphone, label: 'Anunțuri', path: '/announcements', gradient: 'from-info to-primary' },
  },
};

const OperationalRoleDashboard = ({ role }: OperationalRoleDashboardProps) => {
  const config = roleConfig[role || ''] || {
    title: 'Dashboard',
    subtitle: 'Panou de lucru',
    moduleAction: { icon: FileText, label: 'Formulare', path: '/formulare', gradient: 'from-primary to-info' },
  };

  const quickActions: QuickAction[] = [
    config.moduleAction,
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile', gradient: 'from-primary to-info' },
    { icon: Calendar, label: 'Calendar', path: '/leave-calendar', gradient: 'from-accent to-success' },
    { icon: FolderDown, label: 'Formulare', path: '/formulare', gradient: 'from-info to-primary' },
  ];

  return (
    <MainLayout title={config.title} description={config.subtitle}>
      <DashboardAlertsBanner />
      <DashboardGreeting subtitle={config.subtitle} />

      {/* Announcements + Leave */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <DashboardAnnouncements />
        </div>
        <PersonalLeaveWidget />
      </div>

      {/* Quick Actions */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Acțiuni Rapide</h3>
        <QuickActionsGrid actions={quickActions} columns={4} />
      </div>

      {/* Activity + Changelog */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <ActivityHistory />
        <ChangelogWidget />
      </div>
    </MainLayout>
  );
};

export default OperationalRoleDashboard;
