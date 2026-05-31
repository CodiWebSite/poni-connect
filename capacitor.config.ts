import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ro.icmpp.intranet',
  appName: 'ICMPP Intranet',
  webDir: 'dist',
  // Live mode: app loads always the latest version from production
  // For local development with hot-reload, change url to your sandbox preview URL
  server: {
    url: 'https://intranet.icmpp.ro',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'intranet.icmpp.ro',
      '*.icmpp.ro',
      '*.supabase.co',
      'erghywhqrxmwqptusbxd.supabase.co',
      'challenges.cloudflare.com',
      '*.lovable.app',
      '*.lovableproject.com',
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
