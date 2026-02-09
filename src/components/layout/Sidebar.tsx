import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
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
} from 'lucide-react';
import { useState, useEffect } from 'react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isSuperAdmin, canManageHR } = useUserRole();
  const [isCollapsed, setIsCollapsed] = useState(false);
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

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile' },
    { icon: Calendar, label: 'Calendar Concedii', path: '/leave-calendar' },
    ...(canManageHR ? [{ icon: ClipboardList, label: 'Gestiune HR', path: '/hr-management' }] : []),
    { icon: Settings, label: 'Setări', path: '/settings' },
    ...(isSuperAdmin ? [{ icon: Shield, label: 'Administrare', path: '/admin' }] : []),
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 z-50",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
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
      </div>

      {/* User info */}
      <div className="p-3 border-b border-sidebar-border">
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
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
      </div>
    </aside>
  );
};

export default Sidebar;
