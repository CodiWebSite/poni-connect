import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  action: string;            // audit_logs.action
  entityType?: string;
  entityId?: string | null;
  extraDetails?: Record<string, unknown>;
  requirePassword?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function RequireReasonDialog({
  open, onOpenChange,
  title = 'Confirmare acțiune sensibilă',
  description = 'Această acțiune este auditată. Te rugăm să confirmi parola și să oferi un motiv.',
  action, entityType, entityId, extraDetails,
  requirePassword = true,
  onConfirm,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 10) {
      toast({ title: 'Motiv prea scurt', description: 'Te rugăm să descrii motivul în cel puțin 10 caractere.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (requirePassword) {
        if (!user?.email) throw new Error('Sesiune invalidă');
        const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
        if (error) throw new Error('Parolă incorectă');
      }
      await supabase.rpc('log_audit_event', {
        _user_id: user!.id,
        _action: action,
        _entity_type: entityType ?? null,
        _entity_id: entityId ?? null,
        _details: { reason: reason.trim(), ...(extraDetails ?? {}) } as any,
      });
      await onConfirm();
      setPassword(''); setReason('');
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Eroare', description: e?.message ?? 'Acțiune respinsă.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-warning" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Alert>
            <AlertDescription className="text-xs">
              Motivul și acțiunea vor fi înregistrate în jurnalul de audit (GDPR Art. 30).
            </AlertDescription>
          </Alert>
          {requirePassword && (
            <div className="space-y-1.5">
              <Label htmlFor="reason-pwd">Parola contului</Label>
              <Input id="reason-pwd" type="password" autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reason-text">Motiv (min. 10 caractere)</Label>
            <Textarea id="reason-text" rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Ex: Verificare incident raportat de utilizator X..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Anulează</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmă & continuă
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
