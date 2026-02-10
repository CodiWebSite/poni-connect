import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import {
  Home,
  Calendar,
  Settings,
  LogOut,
  Menu,
  Shield,
  UserCircle,
  ClipboardList,
  User,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isSuperAdmin, canManageHR, isSef, isSefSRUS } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);
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
    setIsOpen(false);
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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground p-0">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src="/logo-icmpp.png" alt="ICMPP Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-display font-bold text-lg leading-tight">ICMPP</h1>
              <p className="text-xs text-sidebar-foreground/70">Intranet</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="p-3 border-b border-sidebar-border">
          <Link to="/my-profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-sidebar-foreground/70" />
              )}
            </div>
            {fullName && (
              <span className="text-sm font-medium text-sidebar-foreground truncate">{fullName}</span>
            )}
          </Link>
        </div>

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

        <div className="p-3 border-t border-sidebar-border absolute bottom-0 left-0 right-0 bg-sidebar">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
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
