import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ManualAccountCreate = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('Icmpp2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!email || !fullName || !password) {
      toast({ title: 'Eroare', description: 'Toate câmpurile sunt obligatorii.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: email.trim().toLowerCase(), password, full_name: fullName.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Cont creat cu succes!', description: `${fullName} (${email}) poate acum să se logheze.` });
        setLastCreated({ email: email.trim().toLowerCase(), password });
        setEmail('');
        setFullName('');
        setPassword('Icmpp2026!');
      } else {
        toast({ title: 'Eroare', description: data?.error || 'Nu s-a putut crea contul.', variant: 'destructive' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare necunoscută';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    }
    setCreating(false);
  };

  const copyCredentials = () => {
    if (!lastCreated) return;
    navigator.clipboard.writeText(`Email: ${lastCreated.email}\nParolă temporară: ${lastCreated.password}\n\nTe rugăm să îți schimbi parola după prima logare din Setări sau folosind "Am uitat parola".`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copiat!', description: 'Credențialele au fost copiate în clipboard.' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Creare Cont Manual
          </CardTitle>
          <CardDescription>
            Creează un cont activat direct, fără a fi necesară confirmarea prin email. 
            Util când limita de emailuri este atinsă sau angajatul nu poate primi linkul de activare.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nume complet</Label>
              <Input
                id="fullName"
                placeholder="Ex: Ion Popescu"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email instituțional</Label>
              <Input
                id="email"
                type="email"
                placeholder="Ex: popescu.ion@icmpp.ro"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="password">Parolă temporară</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Angajatul trebuie să-și schimbe parola după prima logare.
            </p>
          </div>
          <Button onClick={handleCreate} disabled={creating || !email || !fullName || !password}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Creează cont
          </Button>
        </CardContent>
      </Card>

      {lastCreated && (
        <Alert className="border-primary/50 bg-primary/5">
          <AlertDescription>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-primary">Cont creat cu succes!</p>
                <p className="text-sm"><strong>Email:</strong> {lastCreated.email}</p>
                <p className="text-sm"><strong>Parolă temporară:</strong> {lastCreated.password}</p>
                <p className="text-xs text-muted-foreground mt-1">Transmite aceste credențiale angajatului în mod securizat.</p>
              </div>
              <Button variant="outline" size="sm" onClick={copyCredentials} className="flex-shrink-0">
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copiat' : 'Copiază'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ManualAccountCreate;
