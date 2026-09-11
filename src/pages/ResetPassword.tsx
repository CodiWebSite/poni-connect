import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MIN_PASSWORD_LENGTH = 10;

const getPasswordResetError = (message: string) => {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('weak') || normalizedMessage.includes('easy to guess')) {
    return 'Această parolă este cunoscută ca fiind compromisă sau prea ușor de ghicit. Alege o parolă unică, de minimum 10 caractere, pe care nu ai mai folosit-o.';
  }

  if (normalizedMessage.includes('same password')) {
    return 'Parola nouă trebuie să fie diferită de parola folosită anterior.';
  }

  if (normalizedMessage.includes('expired') || normalizedMessage.includes('session')) {
    return 'Linkul de resetare a expirat. Solicită un email nou de resetare.';
  }

  return 'Parola nu a putut fi schimbată. Solicită un link nou de resetare și încearcă din nou.';
};

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
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
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

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase handles the token exchange automatically via the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User arrived via recovery link - ready to set new password
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Parolele nu coincid');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere`);
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(getPasswordResetError(error.message), { duration: 9000 });
    } else {
      setIsSuccess(true);
      toast.success('Parola a fost schimbată cu succes!');
      setTimeout(() => navigate('/'), 2000);
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
            <CardTitle className="text-2xl font-display">Resetare Parolă</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Introdu noua parolă pentru contul tău
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {isSuccess ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-lg font-medium">Parola a fost schimbată!</p>
              <p className="text-sm text-muted-foreground">Vei fi redirecționat automat...</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Parolă nouă</Label>
                <PasswordInput
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 10 caractere, parolă unică"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmă parola</Label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetă parola"
                />
              </div>

              <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                {isLoading ? 'Se procesează...' : 'Schimbă parola'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
