import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useSidebarContext } from '@/contexts/SidebarContext';
import {
  Home,
  Calendar,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCircle,
  ClipboardList,
  User,
  FileText,
  FolderDown,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isSuperAdmin, canManageHR, isSef, isSefSRUS } = useUserRole();
  const { isCollapsed, toggleCollapsed } = useSidebarContext();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const mainItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile' },
    { icon: Calendar, label: 'Calendar Concedii', path: '/leave-calendar' },
    { icon: FolderDown, label: 'Formulare', path: '/formulare' },
    ...(isSuperAdmin ? [{ icon: FileText, label: 'Cerere Concediu', path: '/leave-request' }] : []),
  ];

  const managementItems = [
    ...(canManageHR ? [{ icon: ClipboardList, label: 'Gestiune HR', path: '/hr-management' }] : []),
    { icon: Settings, label: 'Setări', path: '/settings' },
    ...(isSuperAdmin ? [{ icon: Shield, label: 'Administrare', path: '/admin' }] : []),
  ];

  const renderNavItem = (item: { icon: any; label: string; path: string }) => {
    const isActive = location.pathname === item.path;
    const linkContent = (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        {/* Active indicator bar */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary-foreground rounded-r-full -ml-3" />
        )}
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {!isCollapsed && <span className="font-medium">{item.label}</span>}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.path} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
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
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 z-50",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header with collapse button */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo-icmpp.png" 
              alt="ICMPP Logo" 
              className="w-10 h-10 object-contain flex-shrink-0"
            />
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="font-display font-bold text-lg leading-tight">ICMPP</h1>
                <p className="text-xs text-sidebar-foreground/70 truncate">Intranet</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent flex-shrink-0"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* User info */}
      <div className="p-3 border-b border-sidebar-border">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link to="/my-profile" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-sidebar-foreground/70" />
                )}
              </div>
              {!isCollapsed && fullName && (
                <span className="text-sm font-medium text-sidebar-foreground truncate">{fullName}</span>
              )}
            </Link>
          </TooltipTrigger>
          {isCollapsed && fullName && (
            <TooltipContent side="right" className="font-medium">{fullName}</TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {/* Main section */}
        {!isCollapsed && (
          <p className="px-3 mb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
            Meniu Principal
          </p>
        )}
        <div className="space-y-1">
          {mainItems.map(renderNavItem)}
        </div>

        {/* Separator */}
        <div className="my-3 border-t border-sidebar-border/50" />

        {/* Management section */}
        {!isCollapsed && (
          <p className="px-3 mb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
            Administrare
          </p>
        )}
        <div className="space-y-1">
          {managementItems.map(renderNavItem)}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className={cn(
                "w-full text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
                isCollapsed ? "justify-center" : "justify-start"
              )}
            >
              <LogOut className="w-5 h-5" />
              {!isCollapsed && <span className="ml-3">Deconectare</span>}
            </Button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="font-medium">Deconectare</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
};

export default Sidebar;
