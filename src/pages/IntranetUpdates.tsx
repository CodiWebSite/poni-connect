import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Shield, Users, FileText, Bell, Calendar, Settings, UserCog, Cake, BookOpen, Bot } from 'lucide-react';

interface Update {
  date: string;
  version: string;
  title: string;
  type: 'feature' | 'improvement' | 'security' | 'fix';
  description: string;
  details?: string[];
}

const updates: Update[] = [
  {
    date: '14 Decembrie 2024',
    version: '1.8.0',
    title: 'Knowledge Base și Asistent AI',
    type: 'feature',
    description: 'Am lansat două funcționalități noi pentru accesul rapid la informații și asistență.',
    details: [
      'Knowledge Base cu articole despre proceduri HR și funcționalități intranet',
      'Asistent AI care răspunde la întrebări folosind informațiile din Knowledge Base',
      'Căutare și filtrare articole după categorie',
      'Administrare articole pentru rolurile Admin și HR',
      'Integrare AI securizată cu autentificare obligatorie'
    ]
  },
  {
    date: '11 Decembrie 2024',
    version: '1.7.0',
    title: 'Widget Zile de Naștere',
    type: 'feature',
    description: 'Am adăugat o funcționalitate pentru a vedea zilele de naștere ale colegilor.',
    details: [
      'Widget pe Dashboard cu zilele de naștere de azi și din următoarele 2 săptămâni',
      'Fiecare angajat își poate seta data nașterii din Profilul Meu',
      'Design festiv pentru ziua de naștere curentă',
      'HR poate completa datele angajaților din Gestiune HR'
    ]
  },
  {
    date: '11 Decembrie 2024',
    version: '1.6.0',
    title: 'Verificare CAPTCHA la autentificare',
    type: 'security',
    description: 'Am adăugat verificare Cloudflare Turnstile pentru a preveni accesul automatizat.',
    details: [
      'CAPTCHA la login și înregistrare',
      'Verificare server-side a token-ului',
      'Restricție domeniu email @icmpp.ro pentru înregistrări noi'
    ]
  },
  {
    date: '11 Decembrie 2024',
    version: '1.5.0',
    title: 'Îmbunătățiri de securitate',
    type: 'security',
    description: 'Am remediat mai multe probleme de securitate identificate în audit.',
    details: [
      'Validare input pentru generarea documentelor HR',
      'Restricții îmbunătățite pentru crearea notificărilor',
      'Funcție nouă pentru protecția datelor sensibile din profiluri'
    ]
  },
  {
    date: '10 Decembrie 2024',
    version: '1.4.0',
    title: 'Sistem de management HR',
    type: 'feature',
    description: 'Pagină dedicată pentru departamentul HR cu gestionarea completă a angajaților.',
    details: [
      'Vizualizare și editare dosare angajați',
      'Gestionare sold zile de concediu',
      'Upload documente în dosarul angajatului',
      'Istoric cereri HR per angajat'
    ]
  },
  {
    date: '9 Decembrie 2024',
    version: '1.3.0',
    title: 'Generare documente HR',
    type: 'feature',
    description: 'Sistem complet pentru crearea și aprobarea cererilor HR.',
    details: [
      'Cereri de concediu cu template DOCX',
      'Generare adeverințe cu AI',
      'Ordine de delegație',
      'Cereri de demisie',
      'Flux de aprobare cu semnături digitale',
      'Notificări în timp real pentru aprobare/respingere'
    ]
  },
  {
    date: '8 Decembrie 2024',
    version: '1.2.0',
    title: 'Profil personal angajat',
    type: 'feature',
    description: 'Fiecare angajat poate accesa și gestiona profilul personal.',
    details: [
      'Vizualizare informații personale',
      'Sold zile concediu (utilizate și rămase)',
      'Documente și contracte personale',
      'Editare date de contact'
    ]
  },
  {
    date: '7 Decembrie 2024',
    version: '1.1.0',
    title: 'Sistem de roluri și permisiuni',
    type: 'feature',
    description: 'Implementare ierarhie de roluri cu permisiuni diferențiate.',
    details: [
      'Roluri: Super Admin, Director, Șef Departament, Secretariat, HR, Angajat',
      'Panou admin pentru gestionarea rolurilor',
      'Restricții de acces bazate pe rol',
      'Permisiuni pentru gestionare conținut și aprobare HR'
    ]
  },
  {
    date: '6 Decembrie 2024',
    version: '1.0.0',
    title: 'Lansare inițială Intranet ICMPP',
    type: 'feature',
    description: 'Prima versiune a platformei intranet pentru angajații institutului.',
    details: [
      'Dashboard cu statistici și anunțuri',
      'Sistem de autentificare securizat',
      'Gestionare anunțuri cu priorități',
      'Calendar evenimente',
      'Bibliotecă documente',
      'Director angajați',
      'Design responsive pentru mobil',
      'Notificări în timp real'
    ]
  }
];

const getTypeColor = (type: Update['type']) => {
  switch (type) {
    case 'feature':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'improvement':
      return 'bg-accent/10 text-accent border-accent/20';
    case 'security':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'fix':
      return 'bg-warning/10 text-warning border-warning/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getTypeLabel = (type: Update['type']) => {
  switch (type) {
    case 'feature':
      return 'Funcționalitate nouă';
    case 'improvement':
      return 'Îmbunătățire';
    case 'security':
      return 'Securitate';
    case 'fix':
      return 'Remediere';
    default:
      return type;
  }
};

const getTypeIcon = (type: Update['type']) => {
  switch (type) {
    case 'feature':
      return Sparkles;
    case 'security':
      return Shield;
    default:
      return Sparkles;
  }
};

const IntranetUpdates = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                Actualizări Intranet
              </h1>
              <p className="text-sm text-muted-foreground">
                Istoricul modificărilor și funcționalităților noi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {updates.map((update, index) => {
            const Icon = getTypeIcon(update.type);
            return (
              <Card key={index} className="relative overflow-hidden">
                {index === 0 && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                    Ultima actualizare
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getTypeColor(update.type)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{update.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {update.date} • Versiunea {update.version}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={getTypeColor(update.type)}>
                      {getTypeLabel(update.type)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-3">{update.description}</p>
                  {update.details && update.details.length > 0 && (
                    <ul className="space-y-1.5">
                      {update.details.map((detail, detailIndex) => (
                        <li 
                          key={detailIndex} 
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <span className="text-primary mt-1.5">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Ai sugestii pentru îmbunătățiri? Contactează echipa IT.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IntranetUpdates;
