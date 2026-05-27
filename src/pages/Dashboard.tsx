import { useState, useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, Clock, X } from 'lucide-react';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import HRStaffDashboard from '@/components/dashboard/HRStaffDashboard';
import SefDepartmentDashboard from '@/components/dashboard/SefDepartmentDashboard';
import MedicMunciiDashboard from '@/components/dashboard/MedicMunciiDashboard';
import OperationalRoleDashboard from '@/components/dashboard/OperationalRoleDashboard';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import { Button } from '@/components/ui/button';

const LEADERSHIP_ROLES = ['sef', 'director_institut', 'director_adjunct', 'secretar_stiintific'];
const OPERATIONAL_ROLES = ['bibliotecar', 'salarizare', 'secretariat', 'achizitii', 'contabilitate', 'oficiu_juridic', 'compartiment_comunicare'];

const STORAGE_KEY = 'secretariat-hours-banner-dismissed';

const SecretariatHoursBanner = ({ children }: { children: React.ReactNode }) => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden">
      {!dismissed && (
        <div className="relative rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/30 dark:to-amber-900/20 p-3 sm:p-4 shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 pr-10">
            <div className="mt-0.5 w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 break-words">
                Program secretariat cu publicul: 09:00–13:00
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1 break-words leading-relaxed">
                Vă informăm că programul de secretariat cu publicul se desfășoară în intervalul 09:00–13:00. Mulțumim pentru înțelegere.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="absolute top-2 right-2 h-7 w-7 text-amber-800/60 hover:text-amber-900 hover:bg-amber-200/40 dark:text-amber-400/60 dark:hover:text-amber-200 dark:hover:bg-amber-800/30"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      {children}
    </div>
  );
};

const Dashboard = () => {
  const { role, isSuperAdmin, isHR, isSefSRUS, isMedicMuncii, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Super Admin — Control Center
  if (isSuperAdmin) return <SecretariatHoursBanner><SuperAdminDashboard /></SecretariatHoursBanner>;

  // HR & SRUS — HR Operations Center
  if (isHR || isSefSRUS) return <SecretariatHoursBanner><HRStaffDashboard /></SecretariatHoursBanner>;

  // Leadership — Department Head Dashboard
  if (role && LEADERSHIP_ROLES.includes(role)) return <SecretariatHoursBanner><SefDepartmentDashboard /></SecretariatHoursBanner>;

  // Medical — Medicina Muncii Dashboard
  if (isMedicMuncii) return <SecretariatHoursBanner><MedicMunciiDashboard /></SecretariatHoursBanner>;

  // Operational roles — Compact module-focused dashboard
  if (role && OPERATIONAL_ROLES.includes(role)) return <SecretariatHoursBanner><OperationalRoleDashboard role={role} /></SecretariatHoursBanner>;

  // Default — Employee Dashboard
  return <SecretariatHoursBanner><EmployeeDashboard /></SecretariatHoursBanner>;
};

export default Dashboard;
