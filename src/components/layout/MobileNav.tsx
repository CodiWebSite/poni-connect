import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Home,
  Megaphone,
  Users,
  FileText,
  Calendar,
  Settings,
  LogOut,
  FlaskConical,
  Menu,
  UserCog,
  Shield,
  UserCircle,
  ClipboardList,
} from 'lucide-react';
import { useState } from 'react';

const MobileNav = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { role, canManageHR } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);

  const isEmployee = role === 'user';

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile' },
    ...(!isEmployee ? [{ icon: Megaphone, label: 'Anunțuri', path: '/announcements' }] : []),
    ...(!isEmployee ? [{ icon: Users, label: 'Angajați', path: '/employees' }] : []),
    ...(!isEmployee ? [{ icon: FileText, label: 'Documente', path: '/documents' }] : []),
    ...(!isEmployee ? [{ icon: UserCog, label: 'Resurse Umane', path: '/hr' }] : []),
    ...(!isEmployee ? [{ icon: Calendar, label: 'Calendar', path: '/calendar' }] : []),
    ...(canManageHR ? [{ icon: ClipboardList, label: 'Gestiune HR', path: '/hr-management' }] : []),
    { icon: Settings, label: 'Setări', path: '/settings' },
    ...(role === 'super_admin' ? [{ icon: Shield, label: 'Administrare', path: '/admin' }] : []),
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground p-0">
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-sidebar-primary to-accent rounded-xl flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight">ICMPP</h1>
              <p className="text-xs text-sidebar-foreground/70">Intranet</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border absolute bottom-0 left-0 right-0 bg-sidebar">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              signOut();
              setIsOpen(false);
            }}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5" />
            <span className="ml-3">Deconectare</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
