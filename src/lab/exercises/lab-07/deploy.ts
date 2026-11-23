/** Lab 07 · Parts 8–9 — EAS Update or a new build, eas.json and app.json settings, what a build gives you. Exercises 14–16. */
import type { MatchExercise, PredictExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

const UPDATE = 'eas update (no new build)';
const BUILD = 'A new build (eas build), then install it';
const options = (correct: 'update' | 'build', updateWhy: string, buildWhy: string) => [
  { text: UPDATE, correct: correct === 'update', why: updateWhy },
  { text: BUILD, correct: correct === 'build', why: buildWhy },
];

export const ex14: PredictExercise = {
  id: id('update-or-build'),
  n: 14,
  title: 'eas update or a new build?',
  minutes: 4,
  level: 5,
  kind: 'predict',
  prompt: 'Smart QR is installed on the students’ phones (a build with `expo-updates`). For each change, choose how it reaches them. Rule: JavaScript and images can travel in an update; anything native needs a new build.',
  questions: [
    {
      code: `// ResultCard.tsx
<AppButton title="Scan agian" … />   →   <AppButton title="Scan again" … />`,
      question: 'A typo in a button.',
      options: options('update', 'Only JavaScript changed. `eas update` sends it; the app downloads it the next time it opens.', 'Works, but it is slower than needed: nothing native changed.'),
    },
    {
      code: `npx expo install expo-location`,
      question: 'A new package with native code.',
      options: options('build', 'An update cannot add native code. The installed app does not have the location module at all.', 'New native code means a new app binary. Updates only go to builds with the same runtime version, so this code must ship in a build.'),
    },
    {
      code: `// app.json → plugins → expo-camera
"cameraPermission": "Allow $(PRODUCT_NAME) to use the camera to read QR codes and Wi-Fi codes."`,
      question: 'The camera permission text.',
      options: options('build', 'The text lives in the native project (the iPhone’s Info.plist), which an update cannot change.', 'Config plugins change native files when the app is built.'),
    },
    {
      code: `// app.json
"icon": "./assets/icon-new.png"`,
      question: 'A new app icon.',
      options: options('build', 'The icon is part of the installed app: the phone shows it before any JavaScript runs.', 'The home-screen icon is packed into the app binary.'),
    },
    {
      code: `// parseScan.ts
// Wi-Fi codes now show the network name instead of the whole code`,
      question: 'A change in how codes are read (the final challenge).',
      options: options('update', 'Pure JavaScript: an update is enough, and it reaches every phone with the same runtime version.', 'Works, but students would have to install a new APK for a JavaScript change.'),
    },
  ],
  hints: [
    'Ask: did anything outside the JavaScript change (a package with native code, app.json settings, the icon)?',
    'Config plugins and the icon are read when the app is built, not when it runs.',
    'Two of the five are updates: the two that only change .ts / .tsx code.',
  ],
  solution: {
    explain: 'An update replaces the JavaScript bundle and images inside an app that is already installed. Native code, permissions and icons are part of the binary: they need a new build.',
    text: '1 · update — 2 · new build — 3 · new build — 4 · new build — 5 · update',
  },
  success: 'This is the same line as Exercise 2 (Expo Go): JavaScript travels fast; native changes need a build.',
};

export const ex15: MatchExercise = {
  id: id('config-match'),
  n: 15,
  title: 'What does each setting do?',
  minutes: 4,
  level: 5,
  kind: 'match',
  mono: true,
  prompt: 'Drag each setting from Smart QR’s `eas.json` and `app.json` to what it does. One chip does not fit any row: leave it out.',
  pairs: [
    { chip: '"distribution": "internal"', target: 'Share the build with a link and a QR code, not through a store', why: 'Internal builds are installed straight from expo.dev: on Android with the link, on iPhone on registered devices.' },
    { chip: '"buildType": "apk"', target: 'Make a file that installs straight on an Android phone', why: 'An .apk installs with a tap. Google Play wants an .aab instead, which is the default.' },
    { chip: '"autoIncrement": true', target: 'Raise the build number by one on every production build', why: 'Every upload to a store needs a higher build number (versionCode / buildNumber).' },
    { chip: '"appVersionSource": "remote"', target: 'EAS keeps the build numbers on its servers, not in app.json', why: 'Then two people building the same app never reuse a number.' },
    { chip: '"developmentClient": true', target: 'Your own Expo Go: a build with the developer tools inside, for daily work', why: 'A development build loads your JavaScript from `npx expo start`, with the native packages you chose.' },
    { chip: '"package": "com.yourname.smartqr"', target: 'The Android app’s unique id in Google Play (it can never change after the first upload)', why: 'Google Play knows your app by this id. iPhones use `ios.bundleIdentifier`.' },
  ],
  decoys: [{ chip: '"buildType": "app-bundle"', why: 'This is the .aab, the default for Android and the file Google Play wants. It cannot be installed straight on a phone, so it fits no row here.' }],
  hints: [
    'Three settings are about which build you get (internal, apk, developmentClient).',
    'Two settings are about numbers (autoIncrement, appVersionSource).',
    'The package name is the app’s id in the store.',
  ],
  solution: {
    explain: 'eas.json chooses what kind of build each profile makes; app.json says what the app is (name, id, icon, plugins).',
    text: 'internal → link and QR · apk → installs straight · autoIncrement → +1 per production build · appVersionSource remote → numbers on EAS · developmentClient → your own Expo Go · package → the id in Google Play · app-bundle → none.',
  },
  success: 'Smart QR’s preview profile combines two of them: internal + apk = a file your classmates install from a link.',
};

export const ex16: PredictExercise = {
  id: id('eas-predict'),
  n: 16,
  title: 'What will this build give you?',
  minutes: 3,
  level: 5,
  kind: 'predict',
  prompt: 'Read the command and the settings, and choose the result.',
  questions: [
    {
      code: `// eas.json
"preview": { "distribution": "internal", "android": { "buildType": "apk" } }

eas build --platform android --profile preview`,
      question: 'What do you get?',
      options: [
        { text: 'An .apk with a link and a QR code to install it', correct: true, why: 'Internal + apk: open the link on an Android phone and install.' },
        { text: 'An .aab for Google Play', why: 'That is the production profile, which has no buildType.' },
        { text: 'An update for Expo Go', why: '`eas build` always makes a new app binary. Updates come from `eas update`.' },
      ],
    },
    {
      code: `Generating a new Android Keystore...
✔ Created keystore`,
      question: 'What is the keystore that EAS made on the first build?',
      options: [
        { text: 'The key that signs the app; every later version must be signed with the same key', correct: true, why: 'Phones and Google Play only accept an update signed like the first version. EAS keeps the key safe for you.' },
        { text: 'The password of your Expo account', why: 'The keystore belongs to the app, not to your account.' },
        { text: 'The APK file itself', why: 'The APK is the result; the keystore is the key that signs it.' },
      ],
    },
    {
      code: `eas build --platform android --profile production`,
      question: 'What do you get?',
      options: [
        { text: 'An .aab for Google Play, with the build number raised by one', correct: true, why: 'The production profile makes an app bundle, and `autoIncrement` raises the versionCode.' },
        { text: 'An .apk to send to friends', why: 'Only profiles with `"buildType": "apk"` make an APK.' },
        { text: 'The app appears in Google Play', why: 'A build only makes the file. Sending it to the store is `eas submit`.' },
      ],
    },
    {
      code: `eas submit --platform android   # the first time`,
      question: 'What must you have before this works?',
      options: [
        { text: 'A Google Play Developer account, the app created in the Play Console, and a Google service account key saved in Expo', correct: true, why: 'Then the first submission creates a release on the internal testing track. It stays a draft until the store listing is complete.' },
        { text: 'Nothing: EAS creates the Play account for you', why: 'The Play account is yours (with a one-time fee). EAS needs a key to upload in your name.' },
        { text: 'A Mac', why: 'Only iPhone apps are tied to Apple. Android submission works from any computer.' },
      ],
    },
  ],
  hints: [
    'The profile decides the file type: apk only where `buildType` says so.',
    'A signing key must never change: it proves that a new version comes from the same developer.',
    'Build makes the file; submit sends it; the store account is always yours.',
  ],
  solution: {
    explain: 'Profile → kind of build; first build → a keystore kept by EAS; build ≠ submit; the store account belongs to you.',
    text: '1 · an .apk with a link — 2 · the signing key — 3 · an .aab with the number + 1 — 4 · a Play Developer account, the app in the Play Console, a service account key in Expo',
  },
  success: 'Part 9 runs the first command for real. Keep the link: your classmates can install your app from it.',
};
