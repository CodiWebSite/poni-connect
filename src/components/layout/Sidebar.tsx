import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import {
  Home,
  Megaphone,
  Users,
  FileText,
  Calendar,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Shield,
  UserCircle,
  ClipboardList,
  ShoppingCart,
  Lightbulb,
  BookOpen,
  Bot,
} from 'lucide-react';
import { useState } from 'react';

const Sidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { role, canManageHR, canManageSecretariat } = useUserRole();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile' },
    { icon: Megaphone, label: 'Anunțuri', path: '/announcements' },
    { icon: Users, label: 'Angajați', path: '/employees' },
    { icon: FileText, label: 'Documente', path: '/documents' },
    { icon: UserCog, label: 'Resurse Umane', path: '/hr' },
    { icon: ShoppingCart, label: 'Achiziții Publice', path: '/procurement' },
    ...(canManageSecretariat ? [{ icon: FileText, label: 'Secretariat', path: '/secretariat' }] : []),
    { icon: BookOpen, label: 'Knowledge Base', path: '/knowledge-base' },
    { icon: Bot, label: 'Asistent AI', path: '/ai-assistant' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: Lightbulb, label: 'Sugestii', path: '/suggestions' },
    ...(canManageHR ? [{ icon: ClipboardList, label: 'Gestiune HR', path: '/hr-management' }] : []),
    ...(canManageSecretariat ? [{ icon: ClipboardList, label: 'Gestiune Secretariat', path: '/secretariat-management' }] : []),
    { icon: Settings, label: 'Setări', path: '/settings' },
    ...(role === 'super_admin' ? [{ icon: Shield, label: 'Administrare', path: '/admin' }] : []),
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
          onClick={signOut}
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
