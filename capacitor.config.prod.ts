import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.controlfile.files.controldoc.app',
  appName: 'ControlFile',
  webDir: '.next', // Usar build de Next.js normal para permitir APIs
  server: {
    androidScheme: 'https'
    // Sin 'url' para usar servidor local embebido con APIs funcionales
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
