import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import HRStaffDashboard from '@/components/dashboard/HRStaffDashboard';
import SefDepartmentDashboard from '@/components/dashboard/SefDepartmentDashboard';
import MedicMunciiDashboard from '@/components/dashboard/MedicMunciiDashboard';
import OperationalRoleDashboard from '@/components/dashboard/OperationalRoleDashboard';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';

const LEADERSHIP_ROLES = ['sef', 'director_institut', 'director_adjunct', 'secretar_stiintific'];
const OPERATIONAL_ROLES = ['bibliotecar', 'salarizare', 'secretariat', 'achizitii', 'contabilitate', 'oficiu_juridic', 'compartiment_comunicare'];

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
  if (isSuperAdmin) return <SuperAdminDashboard />;

  // HR & SRUS — HR Operations Center
  if (isHR || isSefSRUS) return <HRStaffDashboard />;

  // Leadership — Department Head Dashboard
  if (role && LEADERSHIP_ROLES.includes(role)) return <SefDepartmentDashboard />;

  // Medical — Medicina Muncii Dashboard
  if (isMedicMuncii) return <MedicMunciiDashboard />;

  // Operational roles — Compact module-focused dashboard
  if (role && OPERATIONAL_ROLES.includes(role)) return <OperationalRoleDashboard role={role} />;

  // Default — Employee Dashboard
  return <EmployeeDashboard />;
};

export default Dashboard;
