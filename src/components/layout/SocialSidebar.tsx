import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Home,
  MessageSquare,
  Megaphone,
  Heart,
  Briefcase,
  Network,
  PartyPopper,
  MessageCircle,
  Bookmark,
  Archive,
  ShieldCheck,
  Settings,
  LogOut,
  User,
  ArrowLeft,
} from 'lucide-react';

interface NavItem {
  icon: any;
  label: string;
  path: string;
}

const SocialSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { canManageHR, isSuperAdmin } = useUserRole();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('avatar_url, full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url);
          setFullName(data.full_name || '');
        }
      });
  }, [user]);

  const items: NavItem[] = [
    { icon: Home, label: 'Feed-ul tău', path: '/social' },
    { icon: MessageSquare, label: 'Comunități', path: '/social/comunitati' },
    { icon: Megaphone, label: 'Anunțuri', path: '/social/anunturi' },
    { icon: Heart, label: 'Aniversări', path: '/social/aniversari' },
    { icon: Briefcase, label: 'Colegi de muncă', path: '/social/colegi' },
    { icon: Network, label: 'Organigramă', path: '/social/organigrama' },
    { icon: PartyPopper, label: 'Activități', path: '/social/activitati' },
    { icon: MessageCircle, label: 'Mesagerie', path: '/social/chat' },
    { icon: Bookmark, label: 'Salvate', path: '/social/salvate' },
    { icon: Archive, label: 'Arhivă online', path: '/social/arhiva' },
    { icon: ShieldCheck, label: 'Securitate Digitală', path: '/social/securitate' },
    ...(canManageHR || isSuperAdmin
      ? [{ icon: Settings, label: 'Setări', path: '/social/setari' }]
      : []),
  ];

  const isActive = (path: string) =>
    path === '/social' ? location.pathname === '/social' : location.pathname.startsWith(path);

  const initials = (fullName || user?.email || 'U').substring(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-40">
      {/* Header */}
      <div className="p-5">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-5"
          title="Înapoi la Core HR"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <img src="/logo-icmpp.png" alt="ICMPP" className="w-9 h-9 object-contain rounded-xl" />
          <div>
            <h1 className="font-display font-bold text-lg leading-tight text-primary">ICMPP</h1>
            <p className="text-[11px] text-muted-foreground tracking-wide">Social</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <div className="space-y-1">
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                  active
                    ? 'bg-primary/8 text-primary border border-primary/20 font-semibold'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground border border-transparent'
                )}
                style={active ? { backgroundColor: 'hsl(var(--primary) / 0.08)' } : undefined}
              >
                <item.icon className={cn('w-[18px] h-[18px] flex-shrink-0', active && 'text-primary')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer: user + logout */}
      <div className="p-3 border-t border-border">
        <Link
          to="/my-profile"
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-colors mb-1"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-primary">{initials}</span>
            )}
          </div>
          <span className="text-sm font-medium truncate flex-1">{fullName || user?.email}</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
        >
          <LogOut className="w-4 h-4 mr-2.5" />
          <span className="text-sm">Deconectare</span>
        </Button>
      </div>
    </aside>
  );
};

export default SocialSidebar;
