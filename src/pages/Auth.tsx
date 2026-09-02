import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowLeft, MailCheck, HelpCircle, Headset } from 'lucide-react';
import { z } from 'zod';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase } from '@/integrations/supabase/client';
import AccountHelpForm from '@/components/auth/AccountHelpForm';
import HelpdeskContactForm from '@/components/auth/HelpdeskContactForm';
import MolecularPattern from '@/components/auth/MolecularPattern';
import { ShieldCheck, GraduationCap, FileLock2 } from 'lucide-react';
import { BiometricUnlockButton } from '@/components/native/BiometricUnlockButton';



const TURNSTILE_SITE_KEY = '0x4AAAAAACGNQ32sLxuYBXgD';

const isTurnstileRequired = () => {
  if (typeof window === 'undefined') return true;
  const hostname = window.location.hostname;
  return !(
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.lovableproject.com')
  );
};

const loginSchema = z.object({
  email: z.string().email('Adresă de email invalidă'),
  password: z.string().min(6, 'Parola trebuie să aibă cel puțin 6 caractere'),
});

const signupSchema = z.object({
  email: z.string()
    .email('Adresă de email invalidă')
    .refine((email) => email.endsWith('@icmpp.ro'), {
      message: 'Doar adresele de email @icmpp.ro sunt permise pentru înregistrare',
    }),
  password: z.string().min(6, 'Parola trebuie să aibă cel puțin 6 caractere'),
}).extend({
  fullName: z.string().min(2, 'Numele trebuie să aibă cel puțin 2 caractere').max(100, 'Numele este prea lung'),
});

const fieldClass =
  'h-12 rounded-xl border-border bg-card px-4 text-base shadow-sm transition-all placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0';

const labelClass =
  'text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground';

const PasswordInput = ({
  id,
  value,
  onChange,
  placeholder = '••••••••',
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        className={`${fieldClass} pr-12`}
        value={value}
        onChange={onChange}
        required
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
        tabIndex={-1}
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};


const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', password: '', fullName: '' });
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showAccountHelp, setShowAccountHelp] = useState(false);
  const [showHelpdeskForm, setShowHelpdeskForm] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [loginCaptchaError, setLoginCaptchaError] = useState(false);
  const [signupCaptchaError, setSignupCaptchaError] = useState(false);
  const loginTurnstileRef = useRef<TurnstileInstance>(null);
  const signupTurnstileRef = useRef<TurnstileInstance>(null);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const requiresTurnstile = isTurnstileRequired();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const verifyTurnstile = async (token: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-turnstile', {
        body: { token },
      });
      
      if (error) {
        console.error('Turnstile verification error:', error);
        return false;
      }
      
      return data?.success === true;
    } catch (err) {
      console.error('Failed to verify turnstile:', err);
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      loginSchema.parse(loginData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        setIsLoading(false);
        return;
      }
    }

    if (requiresTurnstile && !loginToken) {
      toast.error('Te rugăm să completezi verificarea CAPTCHA');
      setIsLoading(false);
      return;
    }

    const isValid = !requiresTurnstile || await verifyTurnstile(loginToken!);
    if (!isValid) {
      toast.error('Verificarea CAPTCHA a eșuat. Te rugăm să încerci din nou.');
      loginTurnstileRef.current?.reset();
      setLoginToken(null);
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(loginData.email, loginData.password);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email sau parolă incorectă');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Contul nu a fost verificat. Verifică-ți emailul pentru linkul de confirmare.');
      } else {
        toast.error('Eroare la autentificare. Încercați din nou.');
      }
      loginTurnstileRef.current?.reset();
      setLoginToken(null);
    } else {
      toast.success('Autentificare reușită!');
      navigate('/');
    }
    
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      signupSchema.parse(signupData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        setIsLoading(false);
        return;
      }
    }

    if (requiresTurnstile && !signupToken) {
      toast.error('Te rugăm să completezi verificarea CAPTCHA');
      setIsLoading(false);
      return;
    }

    const isValid = !requiresTurnstile || await verifyTurnstile(signupToken!);
    if (!isValid) {
      toast.error('Verificarea CAPTCHA a eșuat. Te rugăm să încerci din nou.');
      signupTurnstileRef.current?.reset();
      setSignupToken(null);
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(signupData.email, signupData.password, signupData.fullName);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Acest email este deja înregistrat. Încearcă să te autentifici sau folosește „Ai uitat parola?".');
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        toast.error('Prea multe încercări. Așteaptă câteva minute sau solicită ajutor folosind butonul de mai jos.', { duration: 8000 });
        setShowAccountHelp(true);
      } else {
        toast.error('Eroare la înregistrare. Dacă problema persistă, solicită ajutor pentru crearea contului.');
      }
      signupTurnstileRef.current?.reset();
      setSignupToken(null);
    } else {
      setConfirmationEmail(signupData.email);
      setShowEmailConfirmation(true);
      setSignupData({ email: '', password: '', fullName: '' });
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!forgotEmail) {
      toast.error('Te rugăm să introduci adresa de email');
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        toast.error('Prea multe încercări de resetare. Așteaptă câteva minute sau solicită ajutor de la administrator.', { duration: 8000 });
        setShowForgotPassword(false);
        setShowAccountHelp(true);
      } else {
        toast.error('Eroare la trimiterea emailului. Încercați din nou.');
      }
    } else {
      toast.success('Email de resetare trimis! Verifică-ți căsuța de email (inclusiv folderul Spam).');
    }

    setIsLoading(false);
  };

  const trustPoints = [
    {
      icon: ShieldCheck,
      title: 'Autentificare în doi pași',
      description: 'TOTP obligatoriu pentru toate conturile instituționale.',
    },
    {
      icon: FileLock2,
      title: 'Politică RGPD',
      description: 'Date prelucrate conform reglementărilor europene și politicii ICMPP.',
    },
    {
      icon: GraduationCap,
      title: 'Domeniu @icmpp.ro',
      description: 'Acces permis exclusiv angajaților institutului.',
    },
  ];

  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col lg:flex-row bg-background overflow-x-hidden">
      {/* Left panel — brand & trust */}
      <aside className="relative hidden lg:flex lg:w-5/12 xl:w-[38%] lg:h-dvh flex-col justify-between p-10 xl:p-14 bg-brand text-brand-foreground overflow-hidden">

        <div className="absolute inset-0 opacity-[0.14] pointer-events-none animate-[pulse_9s_ease-in-out_infinite]">
          <MolecularPattern className="w-full h-full" />
        </div>
        <div
          className="absolute -top-1/4 -right-1/4 w-[36rem] h-[36rem] rounded-full blur-3xl pointer-events-none"
          style={{ background: 'hsl(var(--brand-accent) / 0.12)' }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-foreground p-2 ring-1 ring-brand-foreground/40 shadow-lg flex items-center justify-center">
              <img src="/logo-icmpp.png" alt="Sigla ICMPP" className="w-full h-full object-contain" />
            </div>

            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-muted">
                Academia Română
              </p>
              <p className="font-display text-xl font-semibold">ICMPP „Petru Poni”</p>
            </div>
          </div>

          <h1 className="mt-10 xl:mt-14 font-display text-4xl xl:text-5xl font-bold leading-[1.08]">
            Acces securizat
            <br />
            <span className="text-brand-accent">Intranet ICMPP.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base xl:text-lg font-light text-brand-muted">
            Spațiu de lucru pentru personalul institutului — concedii, documente,
            raportări HR și comunicare internă.
          </p>
        </div>

        <div className="relative z-10 space-y-5">
          {trustPoints.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-4">
              <Icon className="mt-0.5 w-5 h-5 shrink-0 text-brand-accent" strokeWidth={2.2} />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-brand-muted/80 leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
          <p className="pt-5 border-t border-brand-foreground/15 text-[11px] text-brand-muted/70">
            Sistem informatic intern. Accesul neautorizat este interzis și înregistrat.
          </p>
        </div>
      </aside>

      {/* Right panel — auth */}
      <main className="relative flex-1 min-w-0 flex flex-col items-center justify-center px-5 py-8 sm:px-8 lg:h-dvh lg:overflow-y-auto lg:px-14 xl:px-20">
        <div className="absolute inset-0 text-primary opacity-[0.06] pointer-events-none lg:hidden">
          <MolecularPattern className="w-full h-full" />
        </div>

        <div className="relative w-full max-w-md animate-fade-in">
          {/* Mobile brand header */}
          <div className="lg:hidden mb-10 flex flex-col items-center text-center">
            <img
              src="/logo-icmpp.png"
              alt="Sigla ICMPP"
              className="w-16 h-16 object-contain drop-shadow-sm"
            />
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Academia Română
            </p>
            <h1 className="font-display text-2xl font-bold text-foreground">
              ICMPP „Petru Poni”
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Intranet instituțional</p>
          </div>

          {showHelpdeskForm ? (
            <HelpdeskContactForm onBack={() => setShowHelpdeskForm(false)} />
          ) : showAccountHelp ? (
            <AccountHelpForm onBack={() => setShowAccountHelp(false)} />
          ) : showEmailConfirmation ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MailCheck className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-semibold">Verifică-ți emailul</h2>
                <p className="text-sm text-muted-foreground">Am trimis un email de confirmare la:</p>
                <p className="text-sm font-medium text-foreground">{confirmationEmail}</p>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Deschide emailul și apasă pe linkul de confirmare pentru a-ți activa contul.</p>
                <p className="text-xs">
                  Nu ai primit emailul? Verifică folderul Spam sau încearcă din nou peste câteva minute.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailConfirmation(false);
                  setConfirmationEmail('');
                }}
                className="w-full h-12 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Înapoi la autentificare
              </Button>
            </div>
          ) : showForgotPassword ? (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                Înapoi la autentificare
              </button>

              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">Resetare parolă</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Introdu adresa de email și îți vom trimite un link de resetare.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-2.5">
                  <Label htmlFor="forgot-email" className={labelClass}>
                    Adresă de email
                  </Label>
                  <div className="relative">
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="nume@icmpp.ro"
                      className={fieldClass}
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full min-h-12 rounded-xl text-base font-bold shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                  variant="hero"
                  disabled={isLoading}
                >
                  {isLoading ? 'Se trimite...' : 'Trimite link de resetare'}
                </Button>
              </form>
            </div>
          ) : (
            <>
              <div className="hidden lg:block mb-8">
                <h2 className="font-display text-3xl font-bold tracking-tight">Bine ați venit</h2>
                <p className="mt-1.5 text-muted-foreground">
                  Autentifică-te pentru a accesa platforma.
                </p>
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-auto p-1 mb-8 rounded-2xl bg-muted">
                  <TabsTrigger
                    value="login"
                    className="rounded-xl py-2.5 text-sm font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
                  >
                    Autentificare
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="rounded-xl py-2.5 text-sm font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
                  >
                    Înregistrare
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2.5">
                      <Label htmlFor="login-email" className={labelClass}>
                        Adresă de email
                      </Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="nume@icmpp.ro"
                        className={fieldClass}
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="login-password" className={labelClass}>
                          Parolă
                        </Label>
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary transition-colors hover:underline"
                        >
                          Ai uitat parola?
                        </button>
                      </div>
                      <PasswordInput
                        id="login-password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      />
                    </div>

                    {requiresTurnstile && (
                      <div className="flex flex-col items-center gap-3 rounded-xl overflow-hidden w-full [&>div]:max-w-full">
                        <Turnstile
                          ref={loginTurnstileRef}
                          siteKey={TURNSTILE_SITE_KEY}
                          onSuccess={(token) => { setLoginToken(token); setLoginCaptchaError(false); }}
                          onError={() => {
                            setLoginToken(null);
                            setLoginCaptchaError(true);
                          }}
                          onExpire={() => setLoginToken(null)}
                          options={{ theme: 'auto' }}
                        />
                        {loginCaptchaError && (
                          <div className="text-center space-y-2">
                            <p className="text-sm text-destructive">
                              Verificarea CAPTCHA nu a putut fi încărcată. Acest lucru se poate întâmpla în anumite browsere sau rețele.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLoginCaptchaError(false);
                                loginTurnstileRef.current?.reset();
                              }}
                            >
                              Reîncearcă CAPTCHA
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full min-h-12 rounded-xl text-base font-bold shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                      variant="hero"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Se procesează...' : 'Autentificare'}
                    </Button>

                    <BiometricUnlockButton onSuccess={() => navigate('/')} />
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-6">
                    <div className="space-y-2.5">
                      <Label htmlFor="signup-name" className={labelClass}>
                        Nume complet
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Ion Popescu"
                        className={fieldClass}
                        value={signupData.fullName}
                        onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="signup-email" className={labelClass}>
                        Adresă de email
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="nume@icmpp.ro"
                        className={fieldClass}
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="signup-password" className={labelClass}>
                        Parolă
                      </Label>
                      <PasswordInput
                        id="signup-password"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      />
                    </div>

                    {requiresTurnstile && (
                      <div className="flex flex-col items-center gap-3 rounded-xl overflow-hidden w-full [&>div]:max-w-full">
                        <Turnstile
                          ref={signupTurnstileRef}
                          siteKey={TURNSTILE_SITE_KEY}
                          onSuccess={(token) => { setSignupToken(token); setSignupCaptchaError(false); }}
                          onError={() => {
                            setSignupToken(null);
                            setSignupCaptchaError(true);
                          }}
                          onExpire={() => setSignupToken(null)}
                          options={{ theme: 'auto' }}
                        />
                        {signupCaptchaError && (
                          <div className="text-center space-y-2">
                            <p className="text-sm text-destructive">
                              Verificarea CAPTCHA nu a putut fi încărcată. Încearcă să accesezi site-ul direct la <strong>intranet.icmpp.ro</strong> sau reîncearcă.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSignupCaptchaError(false);
                                signupTurnstileRef.current?.reset();
                              }}
                            >
                              Reîncearcă CAPTCHA
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full min-h-12 rounded-xl text-base font-bold shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                      variant="hero"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Se procesează...' : 'Creare cont'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-10 space-y-5">
                <button
                  type="button"
                  onClick={() => setShowAccountHelp(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary/90 transition-colors hover:text-primary"
                >
                  <HelpCircle className="w-4 h-4" />
                  Nu reușești să-ți creezi cont? Solicită ajutor
                </button>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Headset className="w-[18px] h-[18px]" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">
                      Asistență IT instituțională
                    </h3>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    Pentru probleme de autentificare, parolă sau 2FA, contactează echipa IT a
                    Institutului prin formularul securizat.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowHelpdeskForm(true)}
                    className="mt-2.5 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"

                  >
                    <Headset className="w-4 h-4" />
                    Trimite un mesaj echipei IT
                  </button>
                </div>
              </div>
            </>
          )}

          {/* GDPR / legal footer */}
          <footer className="mt-7 pt-4 border-t border-border space-y-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              © {new Date().getFullYear()} ICMPP „Petru Poni” — Academia Română
            </p>
            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <a
                href="/legal/informare-autentificare"
                className="transition-colors hover:text-foreground hover:underline"
              >
                Informare privind prelucrarea datelor
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="/legal/confidentialitate"
                className="transition-colors hover:text-foreground hover:underline"
              >
                Politica de confidențialitate
              </a>
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground/70">
              Prin autentificare confirmi că ai citit informarea RGPD și folosești platforma
              exclusiv în interes de serviciu.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Auth;

