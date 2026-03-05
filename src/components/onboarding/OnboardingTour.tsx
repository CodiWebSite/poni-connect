import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, PartyPopper, Home, UserCircle, FileText, Calendar, FolderDown, Settings, BookOpen, Layout, Megaphone, Users, Headset, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    icon: PartyPopper,
    title: 'Bine ați venit pe platforma ICMPP!',
    description: 'Aceasta este platforma intranet a institutului. Vă vom ghida prin funcționalitățile principale pentru a vă familiariza rapid.',
    color: 'text-primary',
  },
  {
    icon: Layout,
    title: 'Meniul de navigare (Sidebar)',
    description: 'În partea stângă veți găsi meniul principal. De aici accesați toate secțiunile platformei: profilul, cererile de concediu, formulare, anunțuri și setări.',
    color: 'text-blue-500',
  },
  {
    icon: Home,
    title: 'Dashboard',
    description: 'Pagina principală cu acțiuni rapide (Profil, Calendar, Formulare), anunțuri recente, calendarul personal și soldul de concediu.',
    color: 'text-emerald-500',
  },
  {
    icon: Megaphone,
    title: 'Anunțuri',
    description: 'Comunicările oficiale ale instituției. Anunțurile pot fi fixate (pinned), pot conține atașamente și link-uri, și sunt prioritizate vizual.',
    color: 'text-rose-500',
  },
  {
    icon: UserCircle,
    title: 'Profilul Meu',
    description: 'Vedeți datele personale, soldul de concediu (inclusiv report și zile bonus), documentele asociate, istoricul cererilor și puteți solicita corectări.',
    color: 'text-teal-500',
  },
  {
    icon: FileText,
    title: 'Cerere de Concediu',
    description: 'Completați și trimiteți cereri de concediu direct din platformă. Fluxul de aprobare: Șef compartiment → Ofițer SRUS. Descărcați cererea aprobată ca DOCX.',
    color: 'text-amber-500',
  },
  {
    icon: Calendar,
    title: 'Calendar Concedii',
    description: 'Vizualizați concediile colegilor din departament într-un tabel lunar. Weekend-urile și sărbătorile sunt marcate distinct. Vedeți cine e în concediu azi.',
    color: 'text-sky-500',
  },
  {
    icon: FolderDown,
    title: 'Formulare',
    description: 'Descărcați modele oficiale de formulare: cereri, declarații, fișe de solicitare analize, documente deplasări. Organizate pe categorii.',
    color: 'text-violet-500',
  },
  {
    icon: Users,
    title: 'Echipa Mea',
    description: 'Disponibil pentru șefii de departament – vizualizați membrii echipei dvs., informații de contact și statusul concediilor.',
    color: 'text-indigo-500',
  },
  {
    icon: Settings,
    title: 'Setări',
    description: 'Schimbați tema (luminos/întunecat/sistem), actualizați numele și telefonul, schimbați parola și reporniți turul de prezentare.',
    color: 'text-orange-500',
  },
  {
    icon: Headset,
    title: 'Contact IT (HelpDesk)',
    description: 'În partea de jos a meniului găsiți butonul „Contact IT" – trimiteți un tichet direct echipei de suport tehnic pentru orice problemă.',
    color: 'text-cyan-500',
  },
  {
    icon: HelpCircle,
    title: 'Ghid Platformă',
    description: 'Oricând aveți nevoie de ajutor, accesați „Ghid Platformă" din meniu. Conține instrucțiuni pas cu pas pentru fiecare funcționalitate, adaptate rolului dvs.',
    color: 'text-rose-500',
  },
];

interface OnboardingTourProps {
  forceShow?: boolean;
  onClose?: () => void;
}

const OnboardingTour = ({ forceShow = false, onClose }: OnboardingTourProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      setCurrentStep(0);
      setLoading(false);
      return;
    }
    if (!user) { setLoading(false); return; }

    const checkOnboarding = async () => {
      const { data } = await supabase
        .from('user_onboarding' as any)
        .select('tour_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!data) {
        setIsVisible(true);
        await supabase.from('user_onboarding' as any).insert({ user_id: user.id } as any);
      } else if (!(data as any).tour_completed) {
        setIsVisible(true);
      }
      setLoading(false);
    };
    checkOnboarding();
  }, [user, forceShow]);

  const completeTour = useCallback(async () => {
    if (user && !forceShow) {
      await supabase
        .from('user_onboarding' as any)
        .update({ tour_completed: true, completed_at: new Date().toISOString() } as any)
        .eq('user_id', user.id);
    }
    setIsVisible(false);
    onClose?.();
  }, [user, forceShow, onClose]);

  const skipTour = () => completeTour();

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  if (loading || !isVisible) return null;

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={skipTour} />
      
      {/* Card */}
      <Card className="relative z-10 w-full max-w-lg shadow-2xl border-0 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground z-10"
          onClick={skipTour}
        >
          <X className="w-4 h-4" />
        </Button>

        <CardContent className="p-6 sm:p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === currentStep ? 'w-6 bg-primary' : i < currentStep ? 'w-3 bg-primary/40' : 'w-3 bg-muted-foreground/20'
                )}
              />
            ))}
          </div>

          {/* Icon */}
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-primary/10', step.color)}>
            <Icon className="w-7 h-7" />
          </div>

          {/* Content */}
          <h2 className="text-xl font-bold text-foreground mb-2">{step.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{step.description}</p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div>
              {currentStep > 0 ? (
                <Button variant="ghost" size="sm" onClick={prevStep} className="gap-1">
                  <ChevronLeft className="w-4 h-4" />
                  Înapoi
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={skipTour} className="text-muted-foreground">
                  Sari peste tour
                </Button>
              )}
            </div>
            <Button onClick={nextStep} size="sm" className="gap-1">
              {currentStep === STEPS.length - 1 ? 'Începe!' : 'Următorul'}
              {currentStep < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>

          {/* Step count */}
          <p className="text-center text-xs text-muted-foreground mt-4">
            Pasul {currentStep + 1} din {STEPS.length}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingTour;
