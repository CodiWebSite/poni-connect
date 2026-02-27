import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { User, Building2, Phone, Save, Sun, Moon, Monitor, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import OnboardingTour from '@/components/onboarding/OnboardingTour';

interface Profile {
  full_name: string;
  department: string;
  position: string;
  phone: string;
  avatar_url: string;
}

const themeOptions = [
  {
    value: 'light',
    label: 'Luminos',
    icon: Sun,
    preview: {
      bg: 'bg-[hsl(210_20%_98%)]',
      card: 'bg-white',
      text: 'text-[hsl(220_30%_15%)]',
      muted: 'text-[hsl(220_15%_45%)]',
      accent: 'bg-[hsl(215_80%_35%)]',
    },
  },
  {
    value: 'dark',
    label: 'Întunecat',
    icon: Moon,
    preview: {
      bg: 'bg-[hsl(220_30%_8%)]',
      card: 'bg-[hsl(220_30%_12%)]',
      text: 'text-[hsl(210_20%_95%)]',
      muted: 'text-[hsl(210_15%_60%)]',
      accent: 'bg-[hsl(215_80%_55%)]',
    },
  },
  {
    value: 'system',
    label: 'Sistem',
    icon: Monitor,
    preview: {
      bg: 'bg-gradient-to-br from-[hsl(210_20%_98%)] to-[hsl(220_30%_12%)]',
      card: 'bg-gradient-to-br from-white to-[hsl(220_30%_18%)]',
      text: 'text-[hsl(220_30%_15%)]',
      muted: 'text-[hsl(220_15%_45%)]',
      accent: 'bg-[hsl(215_80%_45%)]',
    },
  },
];

const Settings = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    department: '',
    position: '',
    phone: '',
    avatar_url: '',
  });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .maybeSingle();

    if (data) {
      setProfile({
        full_name: data.full_name || '',
        department: data.department || '',
        position: data.position || '',
        phone: data.phone || '',
        avatar_url: data.avatar_url || '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);

    const { error, data } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select();

    console.log('Profile update result:', { error, data, userId: user.id });

    if (error) {
      toast.error('Eroare la salvarea profilului');
    } else {
      toast.success('Profil actualizat cu succes');
    }
    setIsLoading(false);
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <MainLayout title="Setări" description="Gestionează-ți profilul și preferințele">
      <div className="max-w-4xl space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Profilul meu</CardTitle>
            <CardDescription>Actualizează-ți informațiile personale</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-4 rounded-xl bg-muted/50">
                <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-primary/20 shadow-md flex-shrink-0">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg sm:text-xl font-medium">
                    {profile.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left min-w-0">
                  <p className="font-semibold text-base sm:text-lg truncate">{profile.full_name || 'Nume utilizator'}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                  {profile.department && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{profile.department} · {profile.position}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nume complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="full_name"
                      className="pl-10"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      className="pl-10"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+40 XXX XXX XXX"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Departament</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="department" className="pl-10 bg-muted" value={profile.department} disabled placeholder="Setat de HR" />
                  </div>
                  <p className="text-xs text-muted-foreground">Gestionat de departamentul HR</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Funcție</Label>
                  <Input id="position" value={profile.position} disabled className="bg-muted" placeholder="Setat de HR" />
                  <p className="text-xs text-muted-foreground">Gestionat de departamentul HR</p>
                </div>
              </div>

              <Button type="submit" variant="hero" disabled={isLoading}>
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Se salvează...' : 'Salvează modificările'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Theme Card with Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Aspect</CardTitle>
            <CardDescription>Alege tema de culoare preferată</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {themeOptions.map((opt) => {
                const isActive = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      'relative group rounded-xl border-2 p-1 transition-all duration-200 text-left',
                      isActive
                        ? 'border-primary shadow-md shadow-primary/10'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    {/* Mini preview */}
                    <div className={cn('rounded-lg p-3 space-y-2 h-24', opt.preview.bg)}>
                      <div className={cn('h-2 w-12 rounded-full', opt.preview.accent)} />
                      <div className={cn('rounded-md p-2 h-10', opt.preview.card)}>
                        <div className={cn('h-1.5 w-16 rounded-full bg-current opacity-20', opt.preview.text)} />
                        <div className={cn('h-1.5 w-10 rounded-full bg-current opacity-10 mt-1', opt.preview.muted)} />
                      </div>
                    </div>

                    {/* Label */}
                    <div className="flex items-center gap-2 p-3">
                      <opt.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{opt.label}</span>
                      {isActive && (
                        <Check className="w-4 h-4 text-primary ml-auto" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        {/* Restart Tour Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Ajutor</CardTitle>
            <CardDescription>Tour-ul de prezentare al platformei</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="gap-2" onClick={() => setShowTour(true)}>
              <RotateCcw className="w-4 h-4" />
              Reia tour-ul de prezentare
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Repornește ghidul interactiv pas cu pas care prezintă funcționalitățile platformei.
            </p>
          </CardContent>
        </Card>

        {showTour && <OnboardingTour forceShow onClose={() => setShowTour(false)} />}
      </div>
    </MainLayout>
  );
};

export default Settings;
