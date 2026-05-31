/**
 * Native push notifications (FCM on Android).
 * - Requests permission
 * - Registers with FCM
 * - Saves the device token in Supabase (`push_tokens` table)
 * - Wires foreground tap-to-navigate behavior
 *
 * Web fallback: no-op (web push is handled separately via VAPID).
 */
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;

export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[push] permission denied');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        await supabase.from('push_tokens').upsert(
          {
            user_id: data.user.id,
            token: token.value,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' },
        );
      } catch (e) {
        console.warn('[push] token save failed', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] registration error', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notif) => {
      console.log('[push] received in foreground', notif);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data || {};
      // Navigate based on notification payload
      if (data.url) {
        window.location.href = String(data.url);
      } else if (data.related_type === 'leave_request' && data.related_id) {
        window.location.href = `/leave-request?id=${data.related_id}`;
      } else if (data.related_type === 'hr_request' && data.related_id) {
        window.location.href = `/hr-management?ticket=${data.related_id}`;
      }
    });
  } catch (e) {
    console.warn('[push] init failed', e);
  }
}

export async function unregisterPushToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.unregister();
  } catch (e) {
    console.warn('[push] unregister failed', e);
  }
}
