import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { 
  Shield, LogOut, Monitor, MapPin, AlertTriangle, Clock, 
  CheckCircle2, Smartphone, Globe, Loader2, ShieldAlert, ShieldCheck,
  Bell, BellOff, Mail, Vibrate, KeyRound, QrCode
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  details: any;
  acknowledged: boolean;
  created_at: string;
}

interface LoginLog {
  id: string;
  ip_address: string | null;
  device_summary: string | null;
  login_at: string;
  is_suspicious: boolean;
}

interface AlertPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  alert_on_new_device: boolean;
  alert_on_new_ip: boolean;
  alert_on_suspicious_login: boolean;
  alert_on_role_change: boolean;
  alert_on_critical_action: boolean;
}

const defaultPrefs: AlertPreferences = {
  push_enabled: true,
  email_enabled: true,
  alert_on_new_device: true,
  alert_on_new_ip: true,
  alert_on_suspicious_login: true,
  alert_on_role_change: true,
  alert_on_critical_action: true,
};

const eventTypeLabels: Record<string, string> = {
  login_success: 'Autentificare reușită',
  suspicious_login: 'Login suspect',
  new_device: 'Dispozitiv nou',
  new_ip: 'IP nou',
  password_change: 'Parolă schimbată',
  role_change: 'Rol modificat',
  critical_action: 'Acțiune critică',
  logout_all: 'Deconectare globală',
};

const severityConfig: Record<string, { color: string; icon: typeof Shield }> = {
  info: { color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', icon: ShieldCheck },
  warning: { color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: ShieldAlert },
  critical: { color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
};

// 2FA is recommended for ALL users
const MFA_RECOMMENDED_FOR_ALL = true;

export default function SecurityPanel() {
  const { user, signOut } = useAuth();
  const { role } = useUserRole();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [recentLogins, setRecentLogins] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [prefs, setPrefs] = useState<AlertPreferences>(defaultPrefs);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQR, setMfaQR] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaUnenrolling, setMfaUnenrolling] = useState(false);
  const [mfaUnenrollCode, setMfaUnenrollCode] = useState('');
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);

  const shouldRecommendMFA = MFA_RECOMMENDED_FOR_ALL;

  useEffect(() => {
    if (user) {
      fetchData();
      checkMFAStatus();
    }
  }, [user]);

  const checkMFAStatus = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totpFactors = data?.totp || [];
      const verified = totpFactors.find((f: any) => f.status === 'verified');
      setMfaEnabled(!!verified);
      if (verified) setMfaFactorId(verified.id);
    } catch {
      // MFA not available
    }
  };

  const startMFAEnrollment = async () => {
    setMfaEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'ICMPP Intranet',
        friendlyName: user?.email || 'ICMPP Intranet',
      });
      if (error) throw error;
      setMfaQR(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaFactorId(data.id);
    } catch (err: any) {
      toast.error(err.message || 'Eroare la inițializarea 2FA');
    }
    setMfaEnrolling(false);
  };

  const verifyMFAEnrollment = async () => {
    if (!mfaFactorId || mfaVerifyCode.length !== 6) return;
    setMfaVerifying(true);
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaVerifyCode,
      });
      if (verifyErr) throw verifyErr;

      setMfaEnabled(true);
      setMfaQR(null);
      setMfaSecret(null);
      setMfaVerifyCode('');
      toast.success('Autentificare 2FA activată cu succes!');
    } catch (err: any) {
      toast.error(err.message || 'Cod invalid. Încercați din nou.');
    }
    setMfaVerifying(false);
  };

  const unenrollMFA = async () => {
    if (!mfaFactorId || mfaUnenrollCode.length !== 6) return;
    setMfaUnenrolling(true);
    try {
      // First, elevate to AAL2 by verifying a TOTP code
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaUnenrollCode,
      });
      if (verifyErr) throw verifyErr;

      // Now AAL2 — can unenroll
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      setMfaEnabled(false);
      setMfaFactorId(null);
      setShowUnenrollConfirm(false);
      setMfaUnenrollCode('');
      toast.success('2FA dezactivat.');
    } catch (err: any) {
      toast.error(err.message || 'Cod invalid sau eroare la dezactivarea 2FA');
      setMfaUnenrollCode('');
    }
    setMfaUnenrolling(false);
  };

  const fetchData = async () => {
    const [eventsRes, loginsRes, prefsRes] = await Promise.all([
      supabase
        .from('security_events')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('auth_login_logs')
        .select('id, ip_address, device_summary, login_at, is_suspicious')
        .eq('user_id', user!.id)
        .eq('status', 'success')
        .order('login_at', { ascending: false })
        .limit(5),
      supabase
        .from('security_alert_preferences' as any)
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle(),
    ]);

    if (eventsRes.data) setEvents(eventsRes.data as SecurityEvent[]);
    if (loginsRes.data) setRecentLogins(loginsRes.data as LoginLog[]);
    if (prefsRes.data) {
      const p = prefsRes.data as any;
      setPrefs({
        push_enabled: p.push_enabled ?? true,
        email_enabled: p.email_enabled ?? true,
        alert_on_new_device: p.alert_on_new_device ?? true,
        alert_on_new_ip: p.alert_on_new_ip ?? true,
        alert_on_suspicious_login: p.alert_on_suspicious_login ?? true,
        alert_on_role_change: p.alert_on_role_change ?? true,
        alert_on_critical_action: p.alert_on_critical_action ?? true,
      });
    }
    setLoading(false);
  };

  const handleLogoutAll = async () => {
    setLogoutLoading(true);
    try {
      await supabase.functions.invoke('log-auth-event', {
        body: { event_type: 'logout_all', details: { action: 'Deconectare din toate sesiunile' } },
      });
      await supabase.auth.signOut({ scope: 'global' });
      toast.success('Te-ai deconectat din toate sesiunile');
    } catch {
      toast.error('Eroare la deconectare');
    }
    setLogoutLoading(false);
  };

  const updatePrefs = async (key: keyof AlertPreferences, value: boolean) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setSavingPrefs(true);
    try {
      const { error } = await supabase.from('security_alert_preferences' as any).upsert({
        user_id: user!.id,
        ...newPrefs,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id' });
      if (error) throw error;
    } catch {
      toast.error('Eroare la salvarea preferințelor');
      setPrefs(prefs); // revert
    }
    setSavingPrefs(false);
  };

  const unacknowledgedCount = events.filter(e => !e.acknowledged && e.severity !== 'info').length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 2FA / MFA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Autentificare în doi pași (2FA)
            {mfaEnabled ? (
              <Badge className="bg-green-600/10 text-green-700 border-green-200">Activ</Badge>
            ) : shouldRecommendMFA ? (
              <Badge variant="destructive" className="text-xs">Recomandat</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {shouldRecommendMFA && !mfaEnabled
              ? 'Rolul tău necesită activarea autentificării în doi pași pentru securitate sporită.'
              : 'Adaugă un nivel suplimentar de securitate la contul tău.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium">Autentificarea 2FA este activă pe contul tău.</span>
              </div>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={unenrollMFA}
                disabled={mfaUnenrolling}
              >
                {mfaUnenrolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Dezactivează 2FA
              </Button>
            </div>
          ) : mfaQR ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground text-center">
                  Scanează codul QR cu aplicația ta de autentificare (Google Authenticator, Authy, etc.)
                </p>
                <img src={mfaQR} alt="QR Code 2FA" className="w-48 h-48 rounded-lg" />
                {mfaSecret && (
                  <p className="text-xs font-mono bg-background p-2 rounded border select-all">
                    {mfaSecret}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Cod din 6 cifre"
                  value={mfaVerifyCode}
                  onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="w-40 font-mono text-center tracking-widest"
                />
                <Button onClick={verifyMFAEnrollment} disabled={mfaVerifyCode.length !== 6 || mfaVerifying}>
                  {mfaVerifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Verifică și activează
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={startMFAEnrollment} disabled={mfaEnrolling} className="gap-2">
              {mfaEnrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              Configurează 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Sesiuni recente
          </CardTitle>
          <CardDescription>Ultimele autentificări pe contul tău</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentLogins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nu există înregistrări de autentificare.</p>
          ) : (
            <div className="space-y-3">
              {recentLogins.map((login, i) => (
                <div
                  key={login.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="p-2 rounded-full bg-background">
                    {i === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {login.device_summary || 'Dispozitiv necunoscut'}
                      {i === 0 && <Badge variant="outline" className="ml-2 text-xs">Sesiunea curentă</Badge>}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe className="w-3 h-3" />
                      <span>{login.ip_address || 'IP necunoscut'}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      <span>{format(new Date(login.login_at), 'dd MMM yyyy, HH:mm', { locale: ro })}</span>
                    </div>
                  </div>
                  {login.is_suspicious && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Suspect
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive"
            onClick={handleLogoutAll}
            disabled={logoutLoading}
          >
            {logoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Deconectare din toate sesiunile
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Vei fi deconectat de pe toate dispozitivele, inclusiv cel curent.
          </p>
        </CardContent>
      </Card>

      {/* Alert Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Preferințe alerte de securitate
          </CardTitle>
          <CardDescription>Configurează cum primești alertele de securitate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Channels */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Canale de notificare</p>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <Vibrate className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm">Notificări push (în aplicație)</Label>
              </div>
              <Switch checked={prefs.push_enabled} onCheckedChange={(v) => updatePrefs('push_enabled', v)} disabled={savingPrefs} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm">Alerte pe email (pentru evenimente critice)</Label>
              </div>
              <Switch checked={prefs.email_enabled} onCheckedChange={(v) => updatePrefs('email_enabled', v)} disabled={savingPrefs} />
            </div>
          </div>

          <Separator />

          {/* Event types */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Tipuri de alerte</p>
            {([
              { key: 'alert_on_new_device' as const, label: 'Dispozitiv nou detectat', icon: Smartphone },
              { key: 'alert_on_new_ip' as const, label: 'Adresă IP nouă', icon: Globe },
              { key: 'alert_on_suspicious_login' as const, label: 'Login suspect', icon: ShieldAlert },
              { key: 'alert_on_role_change' as const, label: 'Modificare rol', icon: Shield },
              { key: 'alert_on_critical_action' as const, label: 'Acțiune critică', icon: AlertTriangle },
            ]).map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">{label}</Label>
                </div>
                <Switch checked={prefs[key]} onCheckedChange={(v) => updatePrefs(key, v)} disabled={savingPrefs} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Evenimente de securitate
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unacknowledgedCount}</Badge>
            )}
          </CardTitle>
          <CardDescription>Istoric al evenimentelor de securitate pe contul tău</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nu există evenimente de securitate.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.filter(e => e.severity !== 'info').slice(0, 10).map((event) => {
                const config = severityConfig[event.severity] || severityConfig.info;
                const Icon = config.icon;
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className={`p-1.5 rounded-full ${config.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {eventTypeLabels[event.event_type] || event.event_type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.details?.message || event.details?.action || ''}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(event.created_at), 'dd MMM yyyy, HH:mm', { locale: ro })}</span>
                        {event.ip_address && (
                          <>
                            <span>·</span>
                            <MapPin className="w-3 h-3" />
                            <span>{event.ip_address}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
