/**
 * Biometric authentication wrapper (Android fingerprint / face).
 * Stores an encrypted "biometric session token" in Capacitor Preferences after the user
 * enables it; on next launch we use biometric to unlock that token and restore the Supabase session.
 *
 * Web fallback: all methods return safe no-ops.
 */
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const isBiometricSupported = () => Capacitor.isNativePlatform();

const PREF_KEY = 'icmpp_biometric_session';
const PREF_ENABLED = 'icmpp_biometric_enabled';

async function getPrefs() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

async function getBiometric() {
  const mod = await import('@aparajita/capacitor-biometric-auth');
  return mod.BiometricAuth;
}

export async function checkBiometricAvailability(): Promise<{
  available: boolean;
  reason?: string;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, reason: 'Disponibil doar în aplicația Android' };
  }
  try {
    const BiometricAuth = await getBiometric();
    const info = await BiometricAuth.checkBiometry();
    return {
      available: info.isAvailable,
      reason: info.isAvailable ? undefined : info.reason || 'Biometric indisponibil',
    };
  } catch (e: any) {
    return { available: false, reason: e?.message || 'Eroare biometric' };
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const Preferences = await getPrefs();
  const { value } = await Preferences.get({ key: PREF_ENABLED });
  return value === 'true';
}

/**
 * Enable biometric: requires the user to be currently authenticated.
 * Stores the current refresh token after biometric confirmation.
 */
export async function enableBiometric(): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, error: 'Disponibil doar în aplicația Android' };
  }
  const avail = await checkBiometricAvailability();
  if (!avail.available) return { ok: false, error: avail.reason };

  const { data } = await supabase.auth.getSession();
  if (!data.session?.refresh_token) {
    return { ok: false, error: 'Trebuie să fii autentificat ca să activezi biometric.' };
  }

  try {
    const BiometricAuth = await getBiometric();
    await BiometricAuth.authenticate({
      reason: 'Activează autentificarea biometric pentru ICMPP Intranet',
      androidTitle: 'ICMPP Intranet',
      androidSubtitle: 'Activare biometric',
      cancelTitle: 'Anulează',
      allowDeviceCredential: true,
    });

    const Preferences = await getPrefs();
    await Preferences.set({
      key: PREF_KEY,
      value: JSON.stringify({
        refresh_token: data.session.refresh_token,
        saved_at: Date.now(),
      }),
    });
    await Preferences.set({ key: PREF_ENABLED, value: 'true' });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Activare biometric eșuată' };
  }
}

export async function disableBiometric() {
  if (!Capacitor.isNativePlatform()) return;
  const Preferences = await getPrefs();
  await Preferences.remove({ key: PREF_KEY });
  await Preferences.remove({ key: PREF_ENABLED });
}

/**
 * Unlock with biometric: prompts user, then restores the saved refresh token into Supabase.
 * Note: server-side MFA (AAL2) still applies — biometric is only a re-login accelerator.
 */
export async function unlockWithBiometric(): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, error: 'Disponibil doar în aplicația Android' };
  }
  const enabled = await isBiometricEnabled();
  if (!enabled) return { ok: false, error: 'Biometric nu este activat' };

  try {
    const BiometricAuth = await getBiometric();
    await BiometricAuth.authenticate({
      reason: 'Autentificare în ICMPP Intranet',
      androidTitle: 'ICMPP Intranet',
      androidSubtitle: 'Confirmă identitatea',
      cancelTitle: 'Folosește parola',
      allowDeviceCredential: true,
    });

    const Preferences = await getPrefs();
    const { value } = await Preferences.get({ key: PREF_KEY });
    if (!value) return { ok: false, error: 'Token biometric lipsă, reautentifică-te.' };

    const { refresh_token } = JSON.parse(value);
    const { error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) {
      // Stale token — clear so user gets standard login.
      await disableBiometric();
      return { ok: false, error: 'Sesiunea biometric a expirat. Autentifică-te din nou.' };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Autentificare biometric anulată' };
  }
}
