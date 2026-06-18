import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuration Capacitor — App mobile IKCP Family Office
 *
 * Wrap la PWA https://client.ikcp.eu/ en app native iOS + Android,
 * publiable sur App Store + Google Play.
 *
 * Build :
 *   npm install
 *   npx cap sync
 *   npx cap open ios       # Xcode pour publish iOS
 *   npx cap open android   # Android Studio pour publish Play Store
 *
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 */

const config: CapacitorConfig = {
  appId: 'fr.ikcp.familyoffice',
  appName: 'IKCP Family Office',
  webDir: 'www',  // contient un simple index.html qui redirige (voir www/index.html)

  // En production : on charge directement client.ikcp.eu en mode hybrid
  // (URL distante = mise à jour PWA sans repassage validation Apple/Google)
  server: {
    url: 'https://client.ikcp.eu',
    cleartext: false,
    androidScheme: 'https',
  },

  ios: {
    contentInset: 'always',
    backgroundColor: '#0a0d0b',
    scheme: 'IKCP',
    // App Tracking Transparency : on ne tracke pas
    limitsNavigationsToAppBoundDomains: true,
  },

  android: {
    backgroundColor: '#0a0d0b',
    allowMixedContent: false,
    // Force https only
    captureInput: true,
  },

  plugins: {
    // Notifications push pour magic-link, alertes dashboard
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Auth biométrique (Face ID / Touch ID / empreinte)
    BiometricAuth: {
      reason: 'Sécuriser l\'accès à votre Family Office',
      title: 'Authentification IKCP',
    },
    // Splash screen (logo IKCP)
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0d0b',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    // Status bar style sombre (cohérent palette)
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0d0b',
    },
  },
};

export default config;
