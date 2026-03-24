import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useIsApprover } from '@/hooks/useIsApprover';
import { usePageAccess } from '@/hooks/usePageAccess';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSidebarContext } from '@/contexts/SidebarContext';
import {
  Home,
  Calendar,
  Settings,
  LogOut,
  ChevronLeft,
  Shield,
  UserCircle,
  ClipboardList,
  User,
  Users,
  FileText,
  FolderDown,
  BookOpen,
  HelpCircle,
  FlaskConical,
  Banknote,
  ServerCog,
  Megaphone,
  Headset,
  DoorOpen,
  PartyPopper,
  MessageCircle,
  ExternalLink,
  Mail,
  Download,
  Activity,
  Archive,
  CreditCard,
  Newspaper,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { useDemoMode } from '@/contexts/DemoModeContext';
import ITContactDialog from '@/components/shared/ITContactDialog';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { role, isSuperAdmin, canManageHR, isSef, isSefSRUS, canManageLibrary, isSalarizare, canAccessMedical } = useUserRole();
  const { isDesignatedApprover } = useIsApprover();
  const { canAccessPage } = usePageAccess();
  const { isCollapsed, toggleCollapsed } = useSidebarContext();
  const { isDemo, toggleDemo } = useDemoMode();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [pendingHR, setPendingHR] = useState(0);
  const [pendingAdmin, setPendingAdmin] = useState(0);
  const [pendingHelpdesk, setPendingHelpdesk] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('avatar_url, full_name').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setAvatarUrl(data.avatar_url);
            setFullName(data.full_name || '');
          }
        });
    }
  }, [user]);

  // Fetch pending counts for badges
  useEffect(() => {
    if (!canManageHR && !isSuperAdmin && !isSef && !isSefSRUS && !isDesignatedApprover) return;
    const fetchCounts = async () => {
      // Leave requests badge - filtered by department for non-super_admin
      if (canManageHR || isSef || isSefSRUS || isDesignatedApprover) {
        if (isSuperAdmin) {
          // Super admin sees all pending requests
          const { count } = await supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending_department_head' as any);
          setPendingHR(count || 0);
        } else {
          // For dept heads / approvers: fetch all pending, then filter by department
          const { data: pendingData } = await supabase
            .from('leave_requests')
            .select('id, epd_id, approver_id')
            .eq('status', 'pending_department_head' as any);

          if (!pendingData?.length) {
            setPendingHR(0);
          } else {
            // Get user's department and approver departments
            const [{ data: myProfile }, { data: myDeptApprovals }, { data: myEmpApprovals }] = await Promise.all([
              supabase.from('profiles').select('department').eq('user_id', user!.id).maybeSingle(),
              supabase.from('leave_department_approvers').select('department').eq('approver_user_id', user!.id),
              supabase.from('leave_approvers').select('employee_user_id').eq('approver_user_id', user!.id),
            ]);

            const myApproverDepts = new Set((myDeptApprovals || []).map(d => d.department.toLowerCase()));

            // Check active delegations
            const today = new Date().toISOString().split('T')[0];
            const { data: activeDelegations } = await supabase
              .from('leave_approval_delegates' as any)
              .select('delegator_user_id, department')
              .eq('delegate_user_id', user!.id)
              .eq('is_active', true)
              .lte('start_date', today)
              .gte('end_date', today);
            const delegatedApproverIds = new Set((activeDelegations || []).map((d: any) => d.delegator_user_id));
            const delegatedDepts = new Set((activeDelegations || []).map((d: any) => (d.department || '').toLowerCase()).filter(Boolean));

            // Get EPD data for department matching
            const epdIds = [...new Set(pendingData.map(r => r.epd_id).filter(Boolean))];
            let epdDeptMap: Record<string, string> = {};
            if (epdIds.length > 0) {
              const { data: epdData } = await supabase
                .from('employee_personal_data')
                .select('id, department')
                .in('id', epdIds);
              (epdData || []).forEach(e => { epdDeptMap[e.id] = (e.department || '').toLowerCase(); });
            }

            const count = pendingData.filter(r => {
              const empDept = epdDeptMap[r.epd_id] || '';
              // Direct approver assignment
              if (r.approver_id === user!.id) return true;
              // Department-level approver
              if (!r.approver_id && empDept && myApproverDepts.has(empDept)) return true;
              // Generic dept head (same department)
              if (!r.approver_id && (isSef || isSefSRUS) && myProfile?.department &&
                  empDept === myProfile.department.toLowerCase()) return true;
              // Delegated approver
              if (r.approver_id && delegatedApproverIds.has(r.approver_id)) return true;
              if (!r.approver_id && empDept && delegatedDepts.has(empDept)) return true;
              return false;
            }).length;

            setPendingHR(count);
          }
        }
      }

      // Account requests badge - for super admin only
      if (isSuperAdmin) {
        const [{ count: accCount }, { count: hdCount }] = await Promise.all([
          supabase.from('account_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('helpdesk_tickets' as any).select('id', { count: 'exact', head: true }).eq('status', 'open'),
        ]);
        setPendingAdmin(accCount || 0);
        setPendingHelpdesk(hdCount || 0);
      }
    };
    fetchCounts();
  }, [canManageHR, isSuperAdmin, isSef, isSefSRUS, isDesignatedApprover, user]);

  // Fetch total unread chat messages count
  useEffect(() => {
    if (!user) return;
    const fetchUnreadChat = async () => {
      const { data: participantData } = await supabase
        .from('chat_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);
      if (!participantData?.length) { setUnreadChat(0); return; }
      let total = 0;
      const convIds = participantData.map(p => p.conversation_id);
      // Single query: fetch all unread messages across all conversations
      const { data: allMessages } = await supabase
        .from('chat_messages')
        .select('conversation_id, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id);
      if (!allMessages?.length) { setUnreadChat(0); return; }
      // Build lookup for last_read_at per conversation
      const lastReadMap = new Map(participantData.map(p => [p.conversation_id, p.last_read_at]));
      total = allMessages.filter(msg => {
        const lastRead = lastReadMap.get(msg.conversation_id);
        return !lastRead || msg.created_at > lastRead;
      }).length;
      setUnreadChat(total);
    };
    fetchUnreadChat();

    // Listen for new chat messages to update badge + play sound
    const channel = supabase
      .channel('sidebar-chat-badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== user.id) {
          // Only increment if not currently on that conversation
          if (!window.location.pathname.startsWith('/chat')) {
            setUnreadChat(prev => prev + 1);
          }
          // Play notification sound
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
          } catch (e) {
            // Audio not available, ignore
          }
        }
      })
      .subscribe();

    // Listen for read updates to re-fetch badge
    const readChannel = supabase
      .channel('sidebar-chat-read')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.user_id === user.id) {
          fetchUnreadChat();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(readChannel);
    };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Map path to page_key for permission checks
  const pathToPageKey = (path: string): string | null => {
    const map: Record<string, string> = {
      '/': 'dashboard', '/announcements': 'announcements', '/my-profile': 'my-profile',
      '/leave-calendar': 'leave-calendar', '/formulare': 'formulare', '/leave-request': 'leave-request',
      '/my-team': 'my-team', '/library': 'library', '/room-bookings': 'room-bookings',
      '/activitati': 'activitati', '/chat': 'chat', '/medicina-muncii': 'medicina-muncii',
      '/arhiva': 'arhiva', '/ghid': 'ghid', '/install': 'install',
      '/hr-management': 'hr-management', '/salarizare': 'salarizare', '/settings': 'settings',
      '/system-status': 'system-status', '/carti-vizita': 'carti-vizita', '/admin': 'admin',
      '/changelog': 'changelog',
    };
    return map[path] || null;
  };

  const allMainItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: Megaphone, label: 'Anunțuri', path: '/announcements' },
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile' },
    { icon: Calendar, label: 'Calendar Concedii', path: '/leave-calendar' },
    { icon: FolderDown, label: 'Formulare', path: '/formulare' },
    { icon: FileText, label: 'Cerere Concediu', path: '/leave-request', badge: (isSef || isSefSRUS || isSuperAdmin) ? pendingHR : undefined },
    { icon: Users, label: 'Echipa Mea', path: '/my-team' },
    { icon: BookOpen, label: 'Bibliotecă', path: '/library' },
    { icon: DoorOpen, label: 'Programări Săli', path: '/room-bookings' },
    { icon: PartyPopper, label: 'Activități Recreative', path: '/activitati' },
    { icon: MessageCircle, label: 'Mesagerie', path: '/chat', badge: unreadChat || undefined },
    { icon: Activity, label: 'Medicină Muncii', path: '/medicina-muncii' },
    { icon: Archive, label: 'Arhivă Online', path: '/arhiva' },
    { icon: ExternalLink, label: 'Adeverințe SCTP', path: 'https://adeverinte.icmpp.ro/', external: true },
    { icon: Mail, label: 'Mail ICMPP', path: 'https://mail.icmpp.ro/', external: true },
    { icon: HelpCircle, label: 'Ghid Platformă', path: '/ghid' },
    { icon: Download, label: 'Instalează App', path: '/install' },
  ];

  const allManagementItems = [
    { icon: ClipboardList, label: 'Gestiune HR', path: '/hr-management', badge: pendingHR },
    { icon: Banknote, label: 'Salarizare', path: '/salarizare' },
    { icon: Settings, label: 'Setări', path: '/settings' },
    { icon: ServerCog, label: 'Stare Sistem', path: '/system-status' },
    
    { icon: Shield, label: 'Administrare', path: '/admin', badge: pendingAdmin },
    { icon: Newspaper, label: 'Changelog', path: '/changelog' },
  ];

  // Filter items based on DB permissions (+ keep designated approver logic for my-team)
  const filterByAccess = (items: typeof allMainItems) =>
    items.filter(item => {
      if (item.external) return true; // external links always visible
      const pageKey = pathToPageKey(item.path);
      if (!pageKey) return true;
      // Special: designated approvers always see my-team regardless of role config
      if (pageKey === 'my-team' && isDesignatedApprover) return true;
      // Leave calendar: only visible to approvers, HR, admin, super_admin
      if (pageKey === 'leave-calendar') {
        return isSuperAdmin || canManageHR || isSef || isSefSRUS || isDesignatedApprover;
      }
      return canAccessPage(pageKey);
    });

  const mainItems = filterByAccess(allMainItems);
  const managementItems = filterByAccess(allManagementItems);

  const renderNavItem = (item: { icon: any; label: string; path: string; badge?: number; external?: boolean }) => {
    const isExternal = item.external;
    const isActive = !isExternal && location.pathname === item.path;

    const commonClasses = cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-300 relative group text-[13px] tracking-wide",
      isActive
        ? "sidebar-item-active text-sidebar-primary font-semibold"
        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:shadow-[0_0_12px_hsl(var(--sidebar-primary)/0.08)]",
      isCollapsed && isActive && "sidebar-item-active-collapsed justify-center"
    );

    const innerContent = (
      <>
        {/* Active indicator bar */}
        {isActive && !isCollapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary animate-scale-in" />
        )}
        <div className="relative">
          <item.icon className={cn(
            "w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
            isActive && "text-sidebar-primary drop-shadow-[0_0_6px_hsl(var(--sidebar-primary)/0.4)]"
          )} />
          {item.badge && item.badge > 0 && isCollapsed && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center animate-scale-in">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
          {isActive && isCollapsed && (
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sidebar-primary" />
          )}
        </div>
        {!isCollapsed && (
          <>
            <span className="font-medium flex-1">{item.label}</span>
            {item.badge && item.badge > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center animate-scale-in">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </>
    );

    const linkContent = isExternal ? (
      <a
        key={item.path}
        href={item.path}
        target="_blank"
        rel="noopener noreferrer"
        className={commonClasses}
      >
        {innerContent}
      </a>
    ) : (
      <Link
        key={item.path}
        to={item.path}
        className={commonClasses}
      >
        {innerContent}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.path} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="glass font-medium text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen text-sidebar-foreground flex flex-col z-50",
        "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isCollapsed ? "w-20" : "w-64"
      )}
      style={{ background: 'var(--gradient-sidebar)' }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="logo-glow rounded-xl p-0.5">
              <img 
                src="/logo-icmpp.png" 
                alt="ICMPP Logo" 
                className="w-9 h-9 object-contain flex-shrink-0 rounded-xl"
              />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="font-display font-bold text-lg leading-tight gradient-text">ICMPP</h1>
                <p className="text-[11px] text-sidebar-foreground/50 tracking-wide">Intranet</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 flex-shrink-0 transition-all duration-200"
          >
            <ChevronLeft className={cn(
              "w-4 h-4 transition-transform duration-300",
              isCollapsed && "rotate-180"
            )} />
          </Button>
        </div>
      </div>

      <div className="gradient-separator mx-4" />

      {/* User info */}
      <div className="p-3">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link to="/my-profile" className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sidebar-accent/40 transition-all duration-200 group">
              <div className="avatar-gradient-ring flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center overflow-hidden relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-sidebar-foreground/70" />
                  )}
                   {/* Online dot with pulse */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full ring-2 ring-[hsl(var(--sidebar-background))]">
                    <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
                  </span>
                </div>
              </div>
              {!isCollapsed && fullName && (
                <span className="text-[13px] font-medium text-sidebar-foreground/90 truncate group-hover:text-sidebar-foreground transition-colors">{fullName}</span>
              )}
            </Link>
          </TooltipTrigger>
          {isCollapsed && fullName && (
            <TooltipContent side="right" className="glass font-medium text-xs">{fullName}</TooltipContent>
          )}
        </Tooltip>
      </div>

      <div className="gradient-separator mx-4" />

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto sidebar-scrollbar">
        {/* Main section */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-3 mb-3 mt-1">
            <span className="h-px flex-1 bg-sidebar-border/30" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/35 font-semibold">
              Meniu Principal
            </span>
            <span className="h-px flex-1 bg-sidebar-border/30" />
          </div>
        )}
        <div className="space-y-0.5">
          {mainItems.map(renderNavItem)}
        </div>

        {/* Separator */}
        <div className="my-4 gradient-separator mx-2" />

        {/* Management section */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-3 mb-3">
            <span className="h-px flex-1 bg-sidebar-border/30" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/35 font-semibold">
              Administrare
            </span>
            <span className="h-px flex-1 bg-sidebar-border/30" />
          </div>
        )}
        <div className="space-y-0.5">
          {managementItems.map(renderNavItem)}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1.5">
        <div className="gradient-separator mx-2 mb-2" />
        {/* IT Contact */}
        <ITContactDialog
          trigger={
            isCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button className="w-full flex items-center justify-center px-3 py-2 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200 relative group">
                    <Headset className="w-[18px] h-[18px] group-hover:scale-105 transition-transform" />
                    {isSuperAdmin && pendingHelpdesk > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center animate-scale-in">
                        {pendingHelpdesk > 9 ? '9+' : pendingHelpdesk}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="glass font-medium text-xs">
                  Contact IT{isSuperAdmin && pendingHelpdesk > 0 ? ` (${pendingHelpdesk} tichete)` : ''}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200 text-[13px] group">
                <Headset className="w-[18px] h-[18px] flex-shrink-0 group-hover:scale-105 transition-transform" />
                <span className="font-medium flex-1 text-left">Contact IT</span>
                {isSuperAdmin && pendingHelpdesk > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center animate-scale-in">
                    {pendingHelpdesk}
                  </Badge>
                )}
              </button>
            )
          }
        />
        {/* Demo Mode Toggle */}
        {(isSuperAdmin || canManageHR || isSef) && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={toggleDemo}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 text-[13px] group",
                isDemo
                  ? "bg-warning/15 text-warning demo-neon-active"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                isCollapsed && "justify-center px-0"
              )}
            >
              <FlaskConical className={cn("w-[18px] h-[18px] flex-shrink-0 group-hover:scale-105 transition-transform", isDemo && "text-warning")} />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left font-medium">Mod Demo</span>
                  <Switch checked={isDemo} onCheckedChange={toggleDemo} className="pointer-events-none" />
                </>
              )}
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="glass font-medium text-xs">
              Mod Demo {isDemo ? '(Activ)' : '(Inactiv)'}
            </TooltipContent>
          )}
        </Tooltip>
        )}

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className={cn(
                "w-full text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-xl text-[13px] transition-all duration-200 group",
                isCollapsed ? "justify-center" : "justify-start"
              )}
            >
              <LogOut className="w-[18px] h-[18px] group-hover:scale-105 transition-transform" />
              {!isCollapsed && <span className="ml-2.5 font-medium">Deconectare</span>}
            </Button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="glass font-medium text-xs">Deconectare</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
};

export default Sidebar;
