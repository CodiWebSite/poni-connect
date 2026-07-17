import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Monitorizează conectivitatea cu baza de date.
 * - Pinguiește o interogare lightweight la fiecare 20s (30s dacă e ok, 8s când e degradat)
 * - După 2 eșecuri consecutive => afișează overlay full-screen "site în mentenanță automată"
 * - Când baza de date revine => afișează scurt "Serviciile au revenit" și dă reload
 *
 * Nu depinde de app_settings.maintenance_mode (DB poate fi indisponibilă), este pur client-side.
 */
const HEALTHY_INTERVAL_MS = 30_000;
const DEGRADED_INTERVAL_MS = 8_000;
const PING_TIMEOUT_MS = 6_000;
const FAILURES_TO_TRIP = 2;

async function pingDb(): Promise<{ ok: boolean; error?: string; latency: number }> {
  const started = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    // Lightweight query: HEAD-style count on app_settings (public, small)
    const { error } = await supabase
      .from('app_settings')
      .select('key', { count: 'exact', head: true })
      .abortSignal(controller.signal);
    clearTimeout(timer);
    const latency = Math.round(performance.now() - started);
    if (error) return { ok: false, error: error.message, latency };
    return { ok: true, latency };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error', latency: Math.round(performance.now() - started) };
  }
}

export default function DbHealthOverlay() {
  const [down, setDown] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [downSince, setDownSince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const failuresRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const checkingRef = useRef(false);

  const schedule = (ms: number, fn: () => void) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(fn, ms);
  };

  const runCheck = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    const res = await pingDb();
    checkingRef.current = false;

    if (res.ok) {
      failuresRef.current = 0;
      if (down) {
        // DB is back → show "recovered" flash then hard reload
        setRecovering(true);
        setTimeout(() => {
          window.location.reload();
        }, 2500);
        return;
      }
      setLastError(null);
      schedule(HEALTHY_INTERVAL_MS, runCheck);
    } else {
      failuresRef.current += 1;
      setLastError(res.error || 'unknown');
      if (failuresRef.current >= FAILURES_TO_TRIP && !down) {
        setDown(true);
        setDownSince(Date.now());
      }
      schedule(DEGRADED_INTERVAL_MS, runCheck);
    }
  };

  useEffect(() => {
    // Initial ping after 3s (let app boot)
    schedule(3_000, runCheck);
    const onOnline = () => runCheck();
    const onVisible = () => { if (document.visibilityState === 'visible') runCheck(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live "downtime" counter
  useEffect(() => {
    if (!down) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [down]);

  if (!down) return null;

  const seconds = downSince ? Math.floor((now - downSince) / 1000) : 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center text-white">
        {recovering ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Serviciile au revenit</h1>
            <p className="text-white/70 mb-6">Reîncărcăm intranetul...</p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/70" />
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Mentenanță automată</h1>
            <p className="text-white/80 mb-4">
              Baza de date nu răspunde în acest moment. Intranetul intră temporar în mentenanță și va reveni automat imediat ce conexiunea se restabilește.
            </p>
            <p className="text-white/60 text-sm mb-6">Ne cerem scuze pentru inconvenient.</p>

            <div className="bg-black/30 rounded-lg p-4 mb-6 border border-white/10">
              <div className="flex items-center justify-center gap-2 text-white/70 text-sm mb-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificăm conexiunea la fiecare {DEGRADED_INTERVAL_MS / 1000}s
              </div>
              <div className="text-3xl font-bold tabular-nums text-white mt-2">{mm}:{ss}</div>
              <div className="text-xs text-white/50 mt-1">timp de la detectarea problemei</div>
              {lastError && (
                <div className="text-xs text-amber-300/80 mt-3 font-mono break-all">
                  {lastError.slice(0, 120)}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white"
              onClick={() => { failuresRef.current = 0; runCheck(); }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Verifică acum
            </Button>

            <p className="text-white/40 text-xs mt-6">
              Dacă problema persistă, contactează administratorul:{' '}
              <a href="mailto:admin@icmpp.ro" className="underline">admin@icmpp.ro</a>
              {' '}sau{' '}
              <a href="mailto:condrea.codrin@icmpp.ro" className="underline">condrea.codrin@icmpp.ro</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
