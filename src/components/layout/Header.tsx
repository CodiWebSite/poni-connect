import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import MobileNav from '@/components/layout/MobileNav';
import HubSwitcher from '@/components/layout/HubSwitcher';
import { Button } from '@/components/ui/button';
import { Sun, Moon, ChevronRight, FlaskConical, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { formatNumePrenume } from '@/utils/formatName';

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
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    if (user) {
      Promise.all([
        supabase.from('profiles').select('avatar_url, full_name').eq('user_id', user.id).maybeSingle(),
        supabase.from('employee_personal_data').select('last_name, first_name').eq('email', user.email || '').eq('is_archived', false).maybeSingle(),
      ]).then(([{ data: profile }, { data: epd }]) => {
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
        setDisplayName(formatNumePrenume({ firstName: epd?.first_name, lastName: epd?.last_name, fullName: profile?.full_name }));
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
    <header className="sticky top-0 z-40 bg-background/75 backdrop-blur-xl border-b border-border px-3 md:px-6 py-2 md:py-2.5">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Mobile menu button */}
          <MobileNav />

          <div className="min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-base md:text-xl font-display font-semibold text-foreground truncate tracking-tight">{title}</h1>
              {currentRoute !== '/' && breadcrumbLabel && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <ChevronRight className="w-3 h-3" />
                  <Link to="/" className="hover:text-foreground transition-colors">Dashboard</Link>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-foreground/70">{breadcrumbLabel}</span>
                </div>
              )}
            </div>
            {description && currentRoute === '/' && (
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 hidden sm:block">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <GlobalSearch />

          {/* Grouped icon actions */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-secondary/40 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Comută tema"
              className="h-8 w-8 rounded-md transition-transform duration-300 hover:rotate-180"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <HubSwitcher />

            <NotificationBell />
          </div>

          <div className="flex items-center gap-2.5 pl-1.5 md:pl-3 border-l border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5" aria-label="Meniu cont">
                  {/* Avatar with gradient ring */}
                  <div className="rounded-full p-[2px] bg-gradient-to-br from-primary to-accent">
                    <Avatar className="w-8 h-8 border-2 border-background">
                      <AvatarImage src={avatarUrl || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {user?.email ? getInitials(user.email) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="hidden lg:block leading-tight text-left">
                    <p className="text-sm font-medium truncate max-w-[150px]">{displayName || user?.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{displayName || user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Profilul meu
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Setări
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Deconectare
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </div>
    </header>
    {isDemo && (
      <div className="sticky top-[53px] z-[39] bg-warning/90 backdrop-blur-sm text-warning-foreground px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium">
        <FlaskConical className="w-4 h-4" />
        <span>MOD DEMO ACTIV — Acțiunile nu afectează datele reale</span>
        <Button variant="ghost" size="sm" onClick={toggleDemo} className="h-6 px-2 text-warning-foreground hover:bg-warning-foreground/15">
          <X className="w-3 h-3 mr-1" />
          Dezactivează
        </Button>
      </div>
    )}
    </>
  );
};

export default Header;
