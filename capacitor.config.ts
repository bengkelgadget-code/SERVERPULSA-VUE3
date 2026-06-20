import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rog.test.app99',
  appName: 'Server Pulsa Pro',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SpeechRecognition: {
      language: "id-ID",
    },
    BarcodeScanning: {
      formats: ['QR_CODE', 'EAN_13', 'CODE_128']
    }
  },
};

export default config;
