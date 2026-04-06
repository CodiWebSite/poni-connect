import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, ShieldCheck, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MFARecommendationBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!user) return;

    const checkMFA = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const totpFactors = data?.totp || [];
        const verified = totpFactors.find((f: any) => f.status === 'verified');
        setMfaEnabled(!!verified);
      } catch {
        setMfaEnabled(false);
      }
    };

    const fetchName = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile?.full_name) {
        const parts = profile.full_name.split(' ');
        setDisplayName(parts[0] || '');
      }
    };

    checkMFA();
    fetchName();
  }, [user]);

  // Check if dismissed in this session
  useEffect(() => {
    const key = `mfa_banner_dismissed_${user?.id}`;
    if (sessionStorage.getItem(key) === 'true') {
      setDismissed(true);
    }
  }, [user]);

  const handleDismiss = () => {
    setDismissed(true);
    if (user) {
      sessionStorage.setItem(`mfa_banner_dismissed_${user.id}`, 'true');
    }
  };

  // Don't show if MFA already enabled, still loading, or dismissed
  if (mfaEnabled !== false || dismissed) return null;

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-500/30 px-4 py-4 animate-fade-in relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 dark:bg-amber-400/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex-shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
            🔐 {displayName ? `${displayName}, a` : 'A'}ctivează autentificarea în doi pași (2FA)
          </h4>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-1 leading-relaxed">
            Protejează-ți contul Intranet ICMPP cu un nivel suplimentar de securitate. 
            Durează sub 2 minute și necesită doar o aplicație de autentificare pe telefon 
            (Google Authenticator, Authy sau Microsoft Authenticator).
          </p>
          
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Activează 2FA acum
              <ArrowRight className="w-3 h-3" />
            </button>
            <details className="text-xs text-amber-700 dark:text-amber-400">
              <summary className="cursor-pointer hover:underline font-medium py-1.5">
                Cum funcționează?
              </summary>
              <ol className="mt-2 space-y-1.5 list-decimal list-inside text-amber-800/70 dark:text-amber-300/60 pl-1">
                <li>Instalează <strong>Google Authenticator</strong> sau <strong>Authy</strong> pe telefon (gratuit)</li>
                <li>Mergi la <strong>Setări → Securitate → Autentificare 2FA</strong></li>
                <li>Apasă <strong>„Configurează 2FA"</strong> și scanează codul QR cu aplicația</li>
                <li>Introdu codul din 6 cifre generat de aplicație</li>
                <li>Gata! La fiecare autentificare vei folosi și codul din aplicație</li>
              </ol>
            </details>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 p-1 rounded-md hover:bg-amber-200/50 dark:hover:bg-amber-800/30 transition-colors text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
          title="Închide (va reapărea la următoarea sesiune)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default MFARecommendationBanner;
