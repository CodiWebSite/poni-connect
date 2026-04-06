import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldAlert } from 'lucide-react';

interface ReauthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export default function ReauthDialog({
  open,
  onOpenChange,
  onSuccess,
  title = 'Confirmare identitate',
  description = 'Pentru securitate, introdu parola curentă pentru a continua cu această acțiune.',
}: ReauthDialogProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('Eroare la verificarea identității');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) {
        toast.error('Parola este incorectă');
        return;
      }

      setPassword('');
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error('Eroare la verificare');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reauth-password">Parola curentă</Label>
            <Input
              id="reauth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Introdu parola"
              autoComplete="current-password"
              className="mt-1.5"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setPassword(''); onOpenChange(false); }}
              disabled={loading}
            >
              Anulează
            </Button>
            <Button type="submit" disabled={loading || !password.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmă
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
