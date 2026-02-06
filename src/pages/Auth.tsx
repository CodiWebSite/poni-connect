import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { FlaskConical, Lock, Mail, User } from 'lucide-react';
import { z } from 'zod';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase } from '@/integrations/supabase/client';

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

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', password: '', fullName: '' });
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [signupToken, setSignupToken] = useState<string | null>(null);
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
      toast.success('Cont creat cu succes!');
      navigate('/');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative glass animate-scale-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img 
              src="/logo-icmpp.png" 
              alt="ICMPP Logo" 
              className="w-20 h-20 object-contain mx-auto"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">ICMPP Intranet</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Institutul de Chimie Macromoleculară "Petru Poni" Iași
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
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
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <Turnstile
                    ref={loginTurnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    onSuccess={(token) => setLoginToken(token)}
                    onError={() => {
                      setLoginToken(null);
                      toast.error('Eroare la încărcarea CAPTCHA');
                    }}
                    onExpire={() => setLoginToken(null)}
                    options={{
                      theme: 'auto',
                    }}
                  />
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
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <Turnstile
                    ref={signupTurnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    onSuccess={(token) => setSignupToken(token)}
                    onError={() => {
                      setSignupToken(null);
                      toast.error('Eroare la încărcarea CAPTCHA');
                    }}
                    onExpire={() => setSignupToken(null)}
                    options={{
                      theme: 'auto',
                    }}
                  />
                </div>
                
                <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                  {isLoading ? 'Se procesează...' : 'Creare cont'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
