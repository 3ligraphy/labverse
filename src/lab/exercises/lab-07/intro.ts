/** Lab 07 · Parts 1–3 — the tools, Expo Go, the camera permission and haptics. Exercises 1–4 (4 + 3 + 4 + 3 min). */
import type { MatchExercise, PredictExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex01: MatchExercise = {
  id: id('tools-jobs'),
  n: 1,
  title: 'Which tool does which job?',
  minutes: 4,
  level: 1,
  kind: 'match',
  mono: true,
  prompt: 'This lab uses eight tools. Drag each one to its job. One chip is a tool you should **not** use any more: leave it out.',
  pairs: [
    { chip: 'expo-camera', target: 'Show the live camera and read QR codes', why: '`CameraView` shows the camera. Its `onBarcodeScanned` gives your code each QR code it reads.' },
    { chip: 'expo-haptics', target: 'Make the phone vibrate as feedback', why: '`notificationAsync`, `impactAsync` and `selectionAsync` play short vibrations.' },
    { chip: 'Jest', target: 'Run the tests on your computer and say PASS or FAIL', why: 'Jest finds the test files, runs them in Node (no phone needed) and prints the result of each test.' },
    { chip: 'React Native Testing Library', target: 'Draw one screen in a test, press its buttons and read its text', why: 'It renders a component without a phone, so a test can act like a user and check what is on the screen.' },
    { chip: 'Maestro', target: 'Drive the real app on a phone or emulator, step by step', why: 'A Maestro flow (a YAML file) taps, waits and checks the screen of the running app: an end-to-end test.' },
    { chip: 'EAS Build', target: 'Turn the project into an app file you can install (APK, AAB or an iPhone build)', why: 'The build runs on Expo’s servers, so you need neither Android Studio nor a Mac.' },
    { chip: 'EAS Submit', target: 'Upload a finished build to Google Play or the App Store', why: '`eas submit` sends the build to the store for you.' },
    { chip: 'EAS Update', target: 'Send new JavaScript to apps that are already installed', why: 'An update replaces the JavaScript and images without a new build, as long as the native code did not change.' },
  ],
  decoys: [{ chip: 'expo-barcode-scanner', why: 'This old package was removed from Expo. Reading QR codes is now part of `expo-camera`.' }],
  hints: [
    'Two tools are packages your app imports, three are for tests, three start with EAS.',
    'Jest runs tests; React Native Testing Library draws one screen inside a test; Maestro drives the real app.',
    'Build = make the app file. Submit = send it to a store. Update = send new JavaScript to apps already installed.',
  ],
  solution: {
    explain: 'Part 4 uses the two packages, Parts 5–7 the three test tools, Parts 8–9 the three EAS services.',
    text: 'expo-camera → camera and QR codes · expo-haptics → vibration · Jest → runs the tests · React Native Testing Library → one screen in a test · Maestro → the real app, step by step · EAS Build → the app file · EAS Submit → the stores · EAS Update → new JavaScript for installed apps · expo-barcode-scanner → not used (removed).',
  },
  success: 'This is the map of the whole lab: build the scanner with the two packages, test it on three levels, then build and ship it with EAS.',
};

export const ex02: PredictExercise = {
  id: id('expo-go-predict'),
  n: 2,
  title: 'Expo Go or a new build?',
  minutes: 3,
  level: 2,
  kind: 'predict',
  prompt: 'You run the Smart QR project with `npx expo start` and open it in **Expo Go** on your phone. Choose what happens.',
  questions: [
    {
      code: `npx expo install expo-camera expo-haptics
npx expo start   # then scan the QR code with Expo Go`,
      question: 'Do the camera and the vibrations work in Expo Go?',
      options: [
        { text: 'Yes: both packages are already inside Expo Go', correct: true, why: 'Expo Go includes the native code of the Expo SDK packages, `expo-camera` and `expo-haptics` among them.' },
        { text: 'No: you need a development build first', why: 'Only packages whose native code Expo Go does not include need one (for example MMKV in Lab 06).' },
        { text: 'Only the vibrations work', why: 'Both work. The camera needs the user’s permission first (Part 3).' },
      ],
    },
    {
      code: `// app.json
"plugins": [
  ["expo-camera", {
    "cameraPermission": "Allow $(PRODUCT_NAME) to use the camera to read QR codes."
  }]
]`,
      question: 'You test in Expo Go on Android. What does the permission dialog say?',
      options: [
        { text: 'Android’s own sentence, with Expo Go’s name: “Allow Expo Go to take pictures and record video?”', correct: true, why: 'In Expo Go the app asking is Expo Go. Android always writes its own sentence; your text is used by iPhones, and only in your own build (Part 9).' },
        { text: 'Your sentence from app.json', why: 'A config plugin changes the native project when the app is built. Expo Go was built long ago, without your app.json.' },
        { text: 'No dialog: Expo Go may always use the camera', why: 'Every app must ask. Expo Go asks the first time any project uses the camera.' },
      ],
    },
    {
      code: `// ResultCard.tsx
<AppButton title="Scan again" … />   →   <AppButton title="Scan another code" … />`,
      question: 'Expo Go is open. What do you need to see the new text?',
      options: [
        { text: 'Nothing: save the file and the app reloads', correct: true, why: 'Fast Refresh sends the new JavaScript to Expo Go in about a second. Only JavaScript changed.' },
        { text: 'A new EAS build', why: 'Builds are for native changes. A text change is JavaScript.' },
        { text: '`npx expo prebuild`', why: 'Prebuild makes the native android and ios folders. Not needed for JavaScript.' },
      ],
    },
    {
      code: `npx expo install react-native-mmkv`,
      question: 'You add a package with native code that Expo Go does not include. What now?',
      options: [
        { text: 'A development build (with EAS Build or `npx expo run:android`)', correct: true, why: 'New native code means a new app on the phone. A development build is your own “Expo Go” with that code inside.' },
        { text: 'Restart Expo Go', why: 'Restarting does not add native code: Expo Go only has the code it was built with.' },
        { text: 'Nothing: Expo Go downloads it', why: 'Expo Go downloads JavaScript only, never native code.' },
      ],
    },
  ],
  hints: [
    'Expo Go is an app from the store with the Expo SDK’s native code already inside.',
    'Your JavaScript reaches Expo Go at once. Native code and app.json settings need a build.',
    'In Expo Go, the app asking for the camera is Expo Go itself, so the dialog uses its name.',
  ],
  solution: {
    explain: 'Expo Go runs your JavaScript with native code it already has. Anything native (new packages it lacks, config plugins, permission texts) needs your own build.',
    text: '1 · Yes, both are inside Expo Go — 2 · Android’s own sentence with Expo Go’s name — 3 · Nothing: Fast Refresh — 4 · A development build',
  },
  success: 'This is the line between JavaScript (Expo Go, Fast Refresh, EAS Update) and native code (development builds, EAS Build). Part 8 uses the same line to choose between an update and a new build.',
};

export const ex03: PredictExercise = {
  id: id('permission-predict'),
  n: 3,
  title: 'What does the camera give your code?',
  minutes: 4,
  level: 3,
  kind: 'predict',
  prompt: 'Read each piece of code and choose the answer. The phone is an Android phone.',
  questions: [
    {
      code: `const [permission, requestPermission] = useCameraPermissions();
console.log(permission);`,
      question: 'What is printed the very first time the screen draws?',
      options: [
        { text: 'null', correct: true, why: 'The hook is still asking the phone. That is why the screen shows “Checking camera permission…” first.' },
        { text: '{ granted: false }', why: 'That comes a moment later, when the phone has answered.' },
        { text: 'undefined', why: 'The hook gives `null` while it waits.' },
      ],
    },
    {
      code: `// the user pressed “Don’t allow” once
console.log(permission.granted, permission.canAskAgain);`,
      question: 'What is printed?',
      options: [
        { text: 'false true', correct: true, why: 'Not allowed, but Android lets the app ask one more time.' },
        { text: 'false false', why: 'That is after the second “Don’t allow”.' },
        { text: 'true true', why: '“Don’t allow” never gives `granted: true`.' },
      ],
    },
    {
      code: `// the user pressed “Don’t allow” a second time
console.log(permission.canAskAgain); // false
await requestPermission();`,
      question: 'What happens now?',
      options: [
        { text: 'No dialog: only the user can turn the camera on, in the phone’s Settings', correct: true, why: 'So the app shows a button that calls `Linking.openSettings()`, which opens this app’s settings page.' },
        { text: 'The dialog comes back', why: 'After two refusals Android stops showing it. `requestPermission()` just answers “denied”.' },
        { text: 'The app closes', why: 'The app keeps running without the camera. Show the user what to do.' },
      ],
    },
    {
      code: `<CameraView onBarcodeScanned={(scan) => handleScan(scan.data)} />
// handleScan has no lock`,
      question: 'One QR code is held in front of the camera for one second. How many times can `handleScan` run?',
      options: [
        { text: 'Many times: the camera reads the same code again and again', correct: true, why: 'The camera reads every frame it sees. Part 4 adds a lock so one code is handled once.' },
        { text: 'Once', why: 'Only with a lock. The camera itself does not stop.' },
        { text: 'Never, until the user presses a button', why: 'Scanning is automatic: the callback runs as soon as a code is read.' },
      ],
    },
    {
      code: `// on an iPhone, while the camera is still on:
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);`,
      question: 'What does the user feel?',
      options: [
        { text: 'Nothing: iPhones turn haptics off while the camera is active', correct: true, why: 'So Smart QR vibrates on the result card, after the camera closed. iPhones also skip haptics in Low Power Mode.' },
        { text: 'A normal success vibration', why: 'On Android, yes. On an iPhone the camera blocks haptics.' },
        { text: 'An error', why: 'Nothing fails: the call just does nothing.' },
      ],
    },
  ],
  hints: [
    'A hook that reads something from the phone starts with `null`, then gives the answer.',
    'Android asks twice. After the second refusal, `canAskAgain` is false and only Settings can change it.',
    'A camera keeps reading while a code is in view. And iPhones do not vibrate while the camera runs.',
  ],
  solution: {
    explain: 'These five facts shape the scanner screen of Part 4: a loading state, an Allow button, an Open settings button, a lock, and the vibration after the camera closes.',
    text: '1 · null — 2 · false true — 3 · no dialog: open Settings — 4 · many times — 5 · nothing on an iPhone',
  },
  success: 'Every answer is one branch of `ScannerScreen.tsx` in Part 4.',
};

export const ex04: MatchExercise = {
  id: id('haptics-match'),
  n: 4,
  title: 'Which vibration for which moment?',
  minutes: 3,
  level: 3,
  kind: 'match',
  mono: true,
  prompt: 'Drag each haptics call to the moment it fits best. One chip is a bad idea: leave it out.',
  pairs: [
    { chip: 'notificationAsync(NotificationFeedbackType.Success)', target: 'A QR code was read and understood', why: 'The “success” pattern says: the job is done.' },
    { chip: 'notificationAsync(NotificationFeedbackType.Error)', target: 'The code is empty, so the app cannot use it', why: 'A different, stronger pattern says: this did not work.' },
    { chip: 'notificationAsync(NotificationFeedbackType.Warning)', target: 'Nothing failed, but the user should look before going on', why: 'Between success and error: “check this”.' },
    { chip: 'selectionAsync()', target: 'The user flips between the front and back camera', why: 'The lightest tap, made for moving between choices.' },
    { chip: 'impactAsync(ImpactFeedbackStyle.Heavy)', target: 'A big card lands in place at the end of a drag', why: 'An impact feels like two objects touching; Heavy is the strongest.' },
  ],
  decoys: [{ chip: 'notificationAsync(…) in onBarcodeScanned, on every read', why: 'The camera reads many times a second, so the phone would buzz non-stop. Vibrate once, for the result.' }],
  hints: [
    'There are three kinds of call: notification (an outcome), selection (a small choice), impact (something touching).',
    'Success, Warning and Error are the three outcomes.',
    'Too much vibration is as bad as none: one buzz per result.',
  ],
  solution: {
    explain: 'Pick by meaning: an outcome → notificationAsync with its type, a choice → selectionAsync, a physical touch → impactAsync.',
    text: 'Success → code read · Error → empty code · Warning → look before going on · selectionAsync → flip camera · impactAsync(Heavy) → a card lands · a buzz on every read → nowhere.',
  },
  success: 'Smart QR uses exactly three: Success and Error on the result card, selectionAsync on Flip camera (Part 4, Steps C and D).',
};
