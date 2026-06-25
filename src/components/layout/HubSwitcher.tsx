import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Briefcase, Users, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'icmpp_last_hub';

export type Hub = 'core' | 'social';

export function getActiveHub(pathname: string): Hub {
  return pathname.startsWith('/social') ? 'social' : 'core';
}

const HubSwitcher = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeHub = getActiveHub(location.pathname);

  // Persist current hub to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, activeHub);
    } catch {}
  }, [activeHub]);

  const goTo = (hub: Hub) => {
    if (hub === activeHub) return;
    navigate(hub === 'social' ? '/social' : '/');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:h-9 md:w-9 rounded-xl hover:bg-primary/10"
          aria-label="Comută între aplicații"
        >
          <LayoutGrid className="w-4 h-4 md:w-[18px] md:h-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-2 rounded-2xl shadow-xl border-border/60">
        <div className="px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Intranet ICMPP
          </p>
        </div>

        <div className="space-y-1">
          <HubOption
            icon={Briefcase}
            title="Intranet Core HR"
            description="Dashboard, profil, concedii, HR"
            active={activeHub === 'core'}
            onClick={() => goTo('core')}
          />
          <HubOption
            icon={Users}
            title="Intranet Social"
            description="Feed, comunități, colegi"
            active={activeHub === 'social'}
            onClick={() => goTo('social')}
          />
        </div>

        <div className="my-2 h-px bg-border" />

        <Button
          variant="ghost"
          className="w-full justify-start text-sm font-medium rounded-xl"
          onClick={() => navigate('/securitatea-mea')}
        >
          Administrare cont
        </Button>
      </PopoverContent>
    </Popover>
  );
};

interface HubOptionProps {
  icon: any;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}

const HubOption = ({ icon: Icon, title, description, active, onClick }: HubOptionProps) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group',
      active
        ? 'bg-primary/10 border border-primary/20'
        : 'hover:bg-muted border border-transparent'
    )}
  >
    <div
      className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
      )}
    >
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn('text-sm font-semibold leading-tight', active ? 'text-primary' : 'text-foreground')}>
        {title}
      </p>
      <p className="text-[11px] text-muted-foreground truncate">{description}</p>
    </div>
    {active && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
  </button>
);

export default HubSwitcher;
