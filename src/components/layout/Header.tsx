import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import MobileNav from '@/components/layout/MobileNav';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

interface HeaderProps {
  title: string;
  description?: string;
}

const Header = ({ title, description }: HeaderProps) => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <MobileNav />
          
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-display font-bold text-foreground truncate">{title}</h1>
            {description && (
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
              <AvatarImage src="" />
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
  );
};

export default Header;
