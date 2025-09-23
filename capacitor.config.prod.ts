import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.controlfile.files.controldoc.app',
  appName: 'ControlFile',
  webDir: 'out', // Usar assets estáticos para producción
  server: {
    androidScheme: 'https'
    // Sin 'url' para usar assets locales en lugar de servidor remoto
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1f2937",
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1f2937'
    }
  }
};

export default config;
