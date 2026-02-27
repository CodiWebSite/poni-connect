import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import MobileNav from '@/components/layout/MobileNav';
import { Button } from '@/components/ui/button';
import { Sun, Moon, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { FlaskConical, X } from 'lucide-react';

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/my-profile': 'Profilul Meu',
  '/leave-calendar': 'Calendar Concedii',
  '/formulare': 'Formulare',
  '/leave-request': 'Cerere Concediu',
  '/hr-management': 'Gestiune HR',
  '/settings': 'Setări',
  '/admin': 'Administrare',
};

interface HeaderProps {
  title: string;
  description?: ReactNode;
}

const Header = ({ title, description }: HeaderProps) => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isDemo, toggleDemo } = useDemoMode();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('avatar_url').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        });
    }
  }, [user]);

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const currentRoute = location.pathname;
  const breadcrumbLabel = routeLabels[currentRoute];

  return (
    <>
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <MobileNav />
          
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-display font-bold text-foreground truncate">{title}</h1>
            {/* Breadcrumb */}
            {currentRoute !== '/' && breadcrumbLabel && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 hidden sm:flex">
                <Link to="/" className="hover:text-foreground transition-colors">Dashboard</Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground/70">{breadcrumbLabel}</span>
              </div>
            )}
            {description && currentRoute === '/' && (
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 hidden sm:block">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <GlobalSearch />

          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 md:h-9 md:w-9">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <NotificationBell />

          <div className="hidden sm:flex items-center gap-3 pl-2 md:pl-4 border-l border-border">
            <Avatar className="w-8 h-8 md:w-9 md:h-9 border-2 border-primary/20">
              <AvatarImage src={avatarUrl || ''} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs md:text-sm font-medium">
                {user?.email ? getInitials(user.email) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block">
              <p className="text-sm font-medium truncate max-w-[150px]">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
    {isDemo && (
      <div className="sticky top-[57px] z-39 bg-amber-500/90 backdrop-blur-sm text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium">
        <FlaskConical className="w-4 h-4" />
        <span>MOD DEMO ACTIV — Acțiunile nu afectează datele reale</span>
        <Button variant="ghost" size="sm" onClick={toggleDemo} className="h-6 px-2 text-amber-950 hover:bg-amber-600/30">
          <X className="w-3 h-3 mr-1" />
          Dezactivează
        </Button>
      </div>
    )}
    </>
  );
};

export default Header;
