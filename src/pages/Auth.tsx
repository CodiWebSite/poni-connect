import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Lock, Mail, User, Eye, EyeOff, ArrowLeft, CheckCircle2, MailCheck, HelpCircle } from 'lucide-react';
import { z } from 'zod';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase } from '@/integrations/supabase/client';
import AccountHelpForm from '@/components/auth/AccountHelpForm';

const TURNSTILE_SITE_KEY = '0x4AAAAAACGNQ32sLxuYBXgD';

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
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        className="pl-10 pr-10"
        value={value}
        onChange={onChange}
        required
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
  const [forgotEmail, setForgotEmail] = useState('');
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [loginCaptchaError, setLoginCaptchaError] = useState(false);
  const [signupCaptchaError, setSignupCaptchaError] = useState(false);
  const loginTurnstileRef = useRef<TurnstileInstance>(null);
  const signupTurnstileRef = useRef<TurnstileInstance>(null);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

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

    if (!loginToken) {
      toast.error('Te rugăm să completezi verificarea CAPTCHA');
      setIsLoading(false);
      return;
    }

    const isValid = await verifyTurnstile(loginToken);
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

    if (!signupToken) {
      toast.error('Te rugăm să completezi verificarea CAPTCHA');
      setIsLoading(false);
      return;
    }

    const isValid = await verifyTurnstile(signupToken);
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
        toast.error('Acest email este deja înregistrat');
      } else {
        toast.error('Eroare la înregistrare. Încercați din nou.');
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
      toast.error('Eroare la trimiterea emailului. Încercați din nou.');
    } else {
      toast.success('Email de resetare trimis! Verifică-ți căsuța de email.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/8 rounded-full blur-3xl animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/8 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>
      
      <Card className="w-full max-w-md relative animate-fade-in bg-card/90 backdrop-blur-xl border border-border/60 shadow-lg shadow-primary/5">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-150" />
              <img 
                src="/logo-icmpp.png" 
                alt="ICMPP Logo" 
                className="w-24 h-24 object-contain mx-auto relative z-10 drop-shadow-md"
              />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-display">ICMPP Intranet</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Institutul de Chimie Macromoleculară "Petru Poni" Iași
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          {showAccountHelp ? (
            <AccountHelpForm onBack={() => setShowAccountHelp(false)} />
          ) : showEmailConfirmation ? (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Verifică-ți emailul</h3>
                <p className="text-sm text-muted-foreground">
                  Am trimis un email de confirmare la:
                </p>
                <p className="text-sm font-medium text-foreground">{confirmationEmail}</p>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Deschide emailul și apasă pe linkul de confirmare pentru a-ți activa contul.
                </p>
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
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Înapoi la autentificare
              </Button>
            </div>
          ) : showForgotPassword ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Înapoi la autentificare
              </button>

              <div>
                <h3 className="text-lg font-semibold">Resetare parolă</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Introdu adresa de email și îți vom trimite un link de resetare.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="email@icmpp.ro"
                      className="pl-10"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                  {isLoading ? 'Se trimite...' : 'Trimite link de resetare'}
                </Button>
              </form>
            </div>
          ) : (
            <><Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Autentificare</TabsTrigger>
                <TabsTrigger value="signup">Înregistrare</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="email@icmpp.ro"
                        className="pl-10"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Parolă</Label>
                    <PasswordInput
                      id="login-password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      Ai uitat parola?
                    </button>
                  </div>

                  <div className="flex justify-center rounded-lg overflow-hidden [&>div]:max-w-full">
                    <Turnstile
                      ref={loginTurnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => { setLoginToken(token); setLoginCaptchaError(false); }}
                      onError={() => {
                        setLoginToken(null);
                        setLoginCaptchaError(true);
                      }}
                      onExpire={() => setLoginToken(null)}
                      options={{
                        theme: 'auto',
                      }}
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
                  
                  <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                    {isLoading ? 'Se procesează...' : 'Autentificare'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nume complet</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Ion Popescu"
                        className="pl-10"
                        value={signupData.fullName}
                        onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="email@icmpp.ro"
                        className="pl-10"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Parolă</Label>
                    <PasswordInput
                      id="signup-password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-center rounded-lg overflow-hidden [&>div]:max-w-full">
                    <Turnstile
                      ref={signupTurnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => { setSignupToken(token); setSignupCaptchaError(false); }}
                      onError={() => {
                        setSignupToken(null);
                        setSignupCaptchaError(true);
                      }}
                      onExpire={() => setSignupToken(null)}
                      options={{
                        theme: 'auto',
                      }}
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
                  
                  <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                    {isLoading ? 'Se procesează...' : 'Creare cont'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-4 pt-4 border-t border-border text-center">
              <button
                type="button"
                onClick={() => setShowAccountHelp(true)}
                className="text-sm text-primary/80 hover:text-primary transition-colors inline-flex items-center gap-1.5 font-medium"
              >
                <HelpCircle className="w-4 h-4" />
                Nu reușești să-ți creezi cont? Solicită ajutor
              </button>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
