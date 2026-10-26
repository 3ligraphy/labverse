/** Lab 03 · Block 5 — development, staging and production, without leaking secrets. Exercises 14–15. */
import type { CodeExercise, PredictExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex14: PredictExercise = {
  id: id('env-predict'),
  n: 14,
  title: 'Public or secret?',
  minutes: 3,
  level: 4,
  kind: 'predict',
  prompt: 'Expo copies every `EXPO_PUBLIC_` variable **into the app**, where anyone can read it. Decide what may go there.',
  questions: [
    {
      code: `EXPO_PUBLIC_API_URL=https://staging-api.example.com`,
      question: 'Can this be an EXPO_PUBLIC_ variable?',
      options: [
        { text: 'Yes: it is a public address', correct: true, why: 'The app has to know where the API is; the server decides who may use it.' },
        { text: 'No: it must stay on a server', why: 'An API address is not a secret.' },
      ],
    },
    {
      code: `EXPO_PUBLIC_STRIPE_SECRET_KEY=sk_live_51Hx…`,
      question: 'Can this be an EXPO_PUBLIC_ variable?',
      options: [
        { text: 'Yes, if the repository is private', why: 'The value ends up inside the app bundle that every user downloads — private repos don’t help.' },
        { text: 'No: secret keys belong on your server only', correct: true, why: 'Anyone can unpack an app. Your server calls Stripe; the app calls your server.' },
      ],
    },
    {
      code: `EXPO_PUBLIC_APP_ENV=staging`,
      question: 'Can this be an EXPO_PUBLIC_ variable?',
      options: [
        { text: 'Yes: the environment name is harmless', correct: true, why: 'It lets the app show a STAGING badge and pick the right settings.' },
        { text: 'No', why: 'Nothing secret about the name of an environment.' },
      ],
    },
    {
      code: `// .env.staging is committed to GitHub
// .env.example is ignored by Git`,
      question: 'Is this the right way round?',
      options: [
        { text: 'Yes', why: 'Real `.env` files can hold values you don’t want public.' },
        { text: 'No: commit .env.example, ignore the real .env* files', correct: true, why: 'The example documents which variables exist, with fake values.' },
      ],
    },
  ],
  hints: [
    '`EXPO_PUBLIC_` means public — the value is copied into the JavaScript bundle.',
    'Ask: “would I be fine printing this on a poster?”',
    'The example file is the one other people need to see.',
  ],
  success: 'Environment separation organizes **public** settings. It never turns client code into a safe place for secrets.',
};

export const ex15: CodeExercise = {
  id: id('exercise-environment'),
  n: 15,
  title: 'Make the environment visible',
  minutes: 5,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Build the **staging** variant: show a coloured **STAGING** badge and the staging API host. Then remove the secret that must never ship in an app.',
  files: {
    'App.tsx': `import { View, Text } from 'react-native';

const CONFIG = {
  development: { label: 'DEV', apiUrl: 'http://192.168.1.10:3000', color: '#64748b' },
  staging: { label: 'STAGING', apiUrl: 'https://staging-api.example.com', color: '#d97706' },
  production: { label: 'LIVE', apiUrl: 'https://api.example.com', color: '#059669' },
} as const;

// 1. Build the staging variant
const APP_ENV: keyof typeof CONFIG = 'development';

// 2. This must never ship inside a mobile app: delete it, and its line on the screen
const PAYMENTS_SECRET = 'sk_live_51Hx9Q2';

export default function App() {
  const env = CONFIG[APP_ENV];
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white p-6">
      {/* 3. a badge: <Text> with env.label, backgroundColor env.color, white bold text, rounded-full */}
      <Text className="text-2xl font-bold">Campus Companion</Text>
      <Text className="font-mono text-slate-500">{env.apiUrl}</Text>
      <Text className="text-xs text-red-500">{PAYMENTS_SECRET}</Text>
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'staging',
      label: 'the app runs as staging',
      fail: "Set `const APP_ENV: keyof typeof CONFIG = 'staging';`",
      static: (c) => /APP_ENV[^=]*=\s*['"]staging['"]/.test(c.files['App.tsx']),
    },
    {
      id: 'api',
      label: 'shows the staging API host',
      fail: 'The screen should show `env.apiUrl` — the staging address.',
      run: async (c) => /staging-api\.example\.com/.test(await c.app.text()),
    },
    {
      id: 'badge',
      label: 'a coloured STAGING badge',
      fail: 'Add `<Text style={{ backgroundColor: env.color }} className="rounded-full px-3 py-1 font-bold text-white">{env.label}</Text>`.',
      run: async (c) => {
        const found = [...(await c.app.find({ rn: 'Text', text: /^STAGING$/ })), ...(await c.app.find({ rn: 'View', text: /^STAGING$/ }))];
        if (!found.length) return 'I can’t see “STAGING” on the screen yet — show `env.label`.';
        return found.some((f) => typeof f.style.backgroundColor === 'string' && !/^(#fff(fff)?|white|transparent)$/i.test(f.style.backgroundColor));
      },
    },
    {
      id: 'secret',
      label: 'no secret key in the app',
      fail: 'Delete `PAYMENTS_SECRET` and the `<Text>` that shows it. Secret keys live on a server, never in a mobile app.',
      static: (c) => !/sk_live/.test(c.files['App.tsx']),
    },
  ],
  hints: [
    'One word changes the whole app: `APP_ENV` picks the entry in `CONFIG`.',
    'The badge is a `Text` whose `style={{ backgroundColor: env.color }}` comes from the config, so every environment gets its own colour.',
    'Delete both the `PAYMENTS_SECRET` line and the `<Text>` that prints it.',
  ],
  success: 'Testers can now tell at a glance which build they hold. In your project the same choice comes from `APP_VARIANT` in `app.config.ts`, so the three builds can live side by side on one phone.',
};
