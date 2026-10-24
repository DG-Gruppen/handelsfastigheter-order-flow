# SHF Intra som Android-app (och senare iOS)

Appen byggs med [Capacitor 8](https://capacitorjs.com). Webbappen (`dist/`) bäddas in i en native app
med app-id **`se.handelsfastigheter.intra`**. App-id:t får aldrig ändras efter första publiceringen.
Samma kod används för Android och iOS. Bara `android/` finns i repot än så länge, och `ios/` läggs till
på en Mac (se längre ned).

## Så fungerar det

| Del | Webb | App |
|---|---|---|
| Google-inloggning | Lovables inloggning i samma flik | Google blockerar inloggning i appens webbvy. Appen öppnar därför `/app-auth.html` i systemwebbläsaren. Sidan loggar in via Lovable och krypterar sessionen till en tillfällig nyckel som bara appen har. Sedan skickas sessionen tillbaka via `se.handelsfastigheter.intra://auth-callback` (se `src/lib/native/authHandoff.ts`). |
| IT-support-inloggning (e-post) | Oförändrad | Oförändrad |
| Push-notiser | Webbpush (Firebase JS + service worker) | Firebase native via `@capacitor-firebase/messaging`. Tokens sparas i samma `fcm_tokens` och skickas av samma `send-push`. |
| Kamera | Filväljare | Inbyggt val mellan "Ta foto" och "Välj från biblioteket" (chatten och kunskapsbankens editor) |
| Nedladdningar | `<a download>` | Delningsmenyn, där man kan spara i Filer/Drive eller öppna i en annan app (`src/lib/native/files.ts`) |
| Bakåtknapp (Android) | – | Stänger öppen dialog, annars föregående sida |
| Serverfunktioner med låst CORS | `intra.handelsfastigheter.se` | Tillåter också `https://localhost` (Android) och `capacitor://localhost` (iOS) via `supabase/functions/_shared/appOrigins.ts` |

Allt native finns i `src/lib/native/` och `src/components/NativeAppBridge.tsx`. Det används bara när
`isNativeApp()` är sant, så webbappen beter sig som tidigare.

Utskrift i LCC-kalkylatorn döljs i appen, eftersom webbvyn inte kan skriva ut.

## Engångsinställningar

1. **Publicera webben och serverfunktionerna.** `/app-auth.html` måste ligga på
   `https://intra.handelsfastigheter.se` innan Google-inloggningen fungerar i appen. Serverfunktionerna
   `send-push`, `send-email`, `get-passwords-key`, `scrape-website`, `scrape-allabolag`,
   `import-google-workspace`, `notify-workwear-season` och `sync-content-index` måste driftsättas
   med de nya ändringarna.
2. **Firebase (push).** Android-appen är registrerad i Firebase-projektet `intra-notifications-bf349`
   (samma som webbpushen), och `android/app/google-services.json` är incheckad. Filen innehåller bara
   publika id:n. Om filen behöver bytas ut kan den även anges som GitHub-secret `GOOGLE_SERVICES_JSON`,
   och då ersätter den filen i bygget.
3. **Signeringsnyckel (upload key).** Skapa nyckeln en gång och förvara den säkert. Om den tappas bort
   kan Google återställa den när *Play App Signing* används.
   ```bash
   keytool -genkeypair -v -keystore shf-intra-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 shf-intra-upload.jks   # värdet till ANDROID_KEYSTORE_BASE64
   ```
   Lägg in följande GitHub-secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`upload`) och `ANDROID_KEY_PASSWORD`.

## Bygga

**GitHub Actions** (`.github/workflows/android.yml`): kör *Android-app → Run workflow* eller pusha en
tagg `android-vX.Y.Z`. Resultatet blir en debug-APK för test och, om nyckeln finns, en signerad
`app-release.aab` för Google Play. `versionCode` blir körningens nummer och ökar automatiskt.

**Lokalt** (Android Studio, JDK 21):

```bash
bun install
bun run build
npx cap sync android
npx cap open android      # eller: cd android && ./gradlew assembleDebug
```

Ändringar som görs i Lovable hamnar i appen först när den byggs om och publiceras på nytt.

## Google Play

1. Skapa ett Play Console-konto som **organisation** med D-U-N-S-numret.
2. Skapa appen, aktivera *Play App Signing* och ladda upp `app-release.aab` till spåret *Internal testing*.
3. Fyll i *Data safety*, länk till integritetspolicy, skärmbilder och beskrivning.
4. Lägg till ett testkonto för granskningen (e-post och lösenord på en tillåten domän) under *App access*.
5. Publicera publikt, eller bara för organisationen som privat app via *Managed Google Play*
   (Google Workspace `handelsfastigheter.se`).

## iOS (senare, kräver Mac med Xcode)

```bash
npx cap add ios && npx cap sync ios && npx cap open ios
```

- Lägg `GoogleService-Info.plist` (iOS-app i samma Firebase-projekt, bundle-id
  `se.handelsfastigheter.intra`) i `ios/App/App/`. Ladda sedan upp en APNs-nyckel i Firebase
  (*Project settings → Cloud Messaging*).
- Xcode: lägg till *Push Notifications* och *Background Modes → Remote notifications*.
- `AppDelegate.swift`: lägg till de tre metoderna som beskrivs i README för `@capacitor-firebase/messaging`.
- `Info.plist`:
  - URL-schemat `se.handelsfastigheter.intra` under *URL Types*, så att inloggningen kommer tillbaka till appen.
  - `NSCameraUsageDescription` och `NSPhotoLibraryUsageDescription` med svenska texter.
- Webbkoden, serverfunktionerna och `send-push` (APNs-delen) är redan förberedda för iOS.
- Distribuera via Apple Business Manager (*Custom App*) eller App Store.

## Ikoner

Källbilderna ligger i `assets/` och är genererade från `public/pwa-icon-512.png`. Generera om med:

```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#2b445a' --splashBackgroundColor '#2e4a63'
```
