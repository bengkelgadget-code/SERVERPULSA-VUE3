import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.konter.serverpulsa',
  appName: 'Konter Pulsa',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
    }
  }
};

export default config;
