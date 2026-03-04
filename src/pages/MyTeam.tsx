import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface TeamMember {
  epd_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  total_leave_days: number;
  used_leave_days: number;
  avatar_url: string | null;
  bonus_days: number;
  carryover_remaining: number;
}

const MyTeam = () => {
  const { user } = useAuth();
  const { isSef, isSefSRUS, isSuperAdmin, loading: roleLoading } = useUserRole();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<string | null>(null);

  const isDeptHead = isSef || isSefSRUS || isSuperAdmin;

  useEffect(() => {
    if (!user || roleLoading || !isDeptHead) return;
    fetchTeam();
  }, [user, roleLoading, isDeptHead]);

  const fetchTeam = async () => {
    if (!user) return;
    setLoading(true);

    // Get current user's department
    const { data: profile } = await supabase
      .from('profiles')
      .select('department')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.department) {
      setLoading(false);
      return;
    }

    setDepartment(profile.department);

    // Get all employees in the same department
    const { data: employees } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, position, total_leave_days, used_leave_days, employee_record_id')
      .eq('department', profile.department)
      .eq('is_archived', false)
      .order('last_name', { ascending: true });

    if (!employees || employees.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    // Get avatars via employee_record -> user_id -> profiles
    const recordIds = [...new Set(employees.map(e => e.employee_record_id).filter(Boolean))] as string[];
    const avatarMap: Record<string, string> = {};

    if (recordIds.length > 0) {
      const { data: records } = await supabase
        .from('employee_records')
        .select('id, user_id')
        .in('id', recordIds);

      const userIds = (records || []).map(r => r.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, avatar_url')
          .in('user_id', userIds);

        const userAvatarMap: Record<string, string> = {};
        (profiles || []).forEach(p => { if (p.avatar_url) userAvatarMap[p.user_id] = p.avatar_url; });
        (records || []).forEach(r => { if (userAvatarMap[r.user_id]) avatarMap[r.id] = userAvatarMap[r.user_id]; });
      }
    }

    // Get bonus days for current year
    const currentYear = new Date().getFullYear();
    const epdIds = employees.map(e => e.id);

    const { data: bonuses } = await supabase
      .from('leave_bonus')
      .select('employee_personal_data_id, bonus_days')
      .in('employee_personal_data_id', epdIds)
      .eq('year', currentYear);

    const bonusMap: Record<string, number> = {};
    (bonuses || []).forEach(b => {
      bonusMap[b.employee_personal_data_id] = (bonusMap[b.employee_personal_data_id] || 0) + b.bonus_days;
    });

    // Get carryover remaining
    const { data: carryovers } = await supabase
      .from('leave_carryover')
      .select('employee_personal_data_id, remaining_days')
      .in('employee_personal_data_id', epdIds)
      .eq('to_year', currentYear);

    const carryoverMap: Record<string, number> = {};
    (carryovers || []).forEach(c => {
      carryoverMap[c.employee_personal_data_id] = (carryoverMap[c.employee_personal_data_id] || 0) + c.remaining_days;
    });

    const teamMembers: TeamMember[] = employees.map(e => ({
      epd_id: e.id,
      first_name: e.first_name,
      last_name: e.last_name,
      position: e.position,
      total_leave_days: e.total_leave_days || 0,
      used_leave_days: e.used_leave_days || 0,
      avatar_url: e.employee_record_id ? avatarMap[e.employee_record_id] || null : null,
      bonus_days: bonusMap[e.id] || 0,
      carryover_remaining: carryoverMap[e.id] || 0,
    }));

    setMembers(teamMembers);
    setLoading(false);
  };

  if (roleLoading) {
    return (
      <MainLayout title="Echipa Mea">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isDeptHead) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout title="Echipa Mea" description={department ? `Departament: ${department}` : 'Angajații din departamentul dvs.'}>
      <div className="max-w-5xl mx-auto space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nu s-au găsit angajați în departamentul dvs.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-3xl font-bold text-primary">{members.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Angajați activi</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {members.reduce((sum, m) => {
                      const total = m.total_leave_days + m.bonus_days + m.carryover_remaining;
                      const remaining = total - m.used_leave_days;
                      return sum + Math.max(0, remaining);
                    }, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Zile disponibile total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {members.filter(m => {
                      const total = m.total_leave_days + m.bonus_days + m.carryover_remaining;
                      return (total - m.used_leave_days) <= 3 && total > 0;
                    }).length}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Solduri critice (≤3 zile)</p>
                </CardContent>
              </Card>
            </div>

            {/* Members list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-primary" />
                  Angajați – {department}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map(member => {
                    const totalAvailable = member.total_leave_days + member.bonus_days + member.carryover_remaining;
                    const remaining = Math.max(0, totalAvailable - member.used_leave_days);
                    const usedPercent = totalAvailable > 0 ? Math.min(100, (member.used_leave_days / totalAvailable) * 100) : 0;
                    const isCritical = remaining <= 3 && totalAvailable > 0;
                    const initials = `${member.last_name[0] || ''}${member.first_name[0] || ''}`.toUpperCase();

                    return (
                      <div
                        key={member.epd_id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        {/* Avatar + Name */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{member.last_name} {member.first_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.position || '–'}</p>
                          </div>
                        </div>

                        {/* Leave info */}
                        <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                          <div className="text-center min-w-[60px]">
                            <p className="text-xs text-muted-foreground">Drept</p>
                            <p className="font-semibold text-sm">{member.total_leave_days}</p>
                          </div>
                          {member.bonus_days > 0 && (
                            <div className="text-center min-w-[50px]">
                              <p className="text-xs text-muted-foreground">Bonus</p>
                              <p className="font-semibold text-sm text-emerald-600">+{member.bonus_days}</p>
                            </div>
                          )}
                          {member.carryover_remaining > 0 && (
                            <div className="text-center min-w-[50px]">
                              <p className="text-xs text-muted-foreground">Report</p>
                              <p className="font-semibold text-sm text-blue-600">+{member.carryover_remaining}</p>
                            </div>
                          )}
                          <div className="text-center min-w-[60px]">
                            <p className="text-xs text-muted-foreground">Folosit</p>
                            <p className="font-semibold text-sm">{member.used_leave_days}</p>
                          </div>
                          <div className="text-center min-w-[70px]">
                            <p className="text-xs text-muted-foreground">Disponibil</p>
                            <div className="flex items-center gap-1.5">
                              <p className={`font-bold text-sm ${isCritical ? 'text-destructive' : 'text-primary'}`}>
                                {remaining}
                              </p>
                              {isCritical && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                            </div>
                          </div>
                          <div className="hidden sm:block w-24">
                            <Progress value={usedPercent} className="h-2" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default MyTeam;
