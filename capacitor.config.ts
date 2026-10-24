import type { CapacitorConfig } from "@capacitor/cli";

// Native Android/iOS-app för SHF Intra. Webbappen byggs till dist/ och bäddas in i appen.
// appId får aldrig ändras efter första publiceringen i Google Play / App Store.
const config: CapacitorConfig = {
  appId: "se.handelsfastigheter.intra",
  appName: "SHF Intra",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      // Döljs av NativeAppBridge när webbappen har laddat; tiden är bara en övre gräns.
      launchShowDuration: 3000,
      backgroundColor: "#2e4a63",
      showSpinner: false,
    },
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  experimental: {
    ios: {
      // Krävs av @capacitor-firebase/messaging med Swift Package Manager (iOS).
      spm: { packageOptions: { "@capacitor-firebase/messaging": { symlink: true } } },
    },
  },
};

export default config;
