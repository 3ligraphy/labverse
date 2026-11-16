/** Lab 06 · Part 4 — secrets: secure storage. Exercises 7–8 (3 + 7 = 10 min). */
import type { CodeExercise, PredictExercise } from '../types.ts';
import { LAB_ID } from './meta.ts';
import { allCode, code, secureKeys, until, waitForText } from './shared.ts';

const id = (name: string) => `${LAB_ID}--${name}`;

export const ex07: PredictExercise = {
  id: id('secrets-predict'),
  n: 7,
  title: 'Who can read the token?',
  minutes: 3,
  level: 3,
  kind: 'predict',
  prompt: 'A sign-in token lets anyone act as the user. For each piece of code, choose what is true.',
  questions: [
    {
      code: `await AsyncStorage.setItem('token', token);`,
      question: 'Someone copies the app’s files from a rooted phone, or from a backup. Can they read the token?',
      options: [
        { text: 'Yes: AsyncStorage is a plain, unencrypted file', correct: true, why: 'The phone stops other apps, not someone who has the files. AsyncStorage keeps plain text.' },
        { text: 'No: only this app can open AsyncStorage', why: 'Other apps cannot, but a copy of the files (rooted phone, backup) can be read by anyone.' },
        { text: 'No: a token is too long to read', why: 'Length does not protect anything. The text is stored as it is.' },
      ],
    },
    {
      code: `await SecureStore.setItemAsync('token', token);`,
      question: 'The same copy of the app’s files. Can they read the token now?',
      options: [
        { text: 'No: it is encrypted, and the key is held by the Keychain (iOS) or Keystore (Android)', correct: true, why: 'On disk there are only unreadable bytes. The key that opens them never leaves the phone’s secure hardware.' },
        { text: 'Yes: it is the same file as AsyncStorage', why: 'SecureStore uses the Keychain / Keystore, not the AsyncStorage file.' },
        { text: 'Yes, any app can ask SecureStore for it', why: 'Each app has its own SecureStore. Another app cannot read yours.' },
      ],
    },
    {
      code: `console.log('Signed in with', token);`,
      question: 'What is wrong here?',
      options: [
        { text: 'The token ends up in logs that tools, crash reports and other people can read', correct: true, why: 'Logs are copied to the terminal, to crash reports and to log services. Never log secrets.' },
        { text: 'Nothing: logs are private', why: 'Logs are made to be read by people and tools: the opposite of private.' },
        { text: 'console.log is too slow', why: 'Speed is not the problem. The secret leaving the safe place is.' },
      ],
    },
    {
      code: `// .env of an Expo app
EXPO_PUBLIC_SUPABASE_SECRET_KEY=sb_secret_…`,
      question: 'Is this safe?',
      options: [
        { text: 'No: every EXPO_PUBLIC_ value is built into the app, and anyone can read the app', correct: true, why: 'Expo copies EXPO_PUBLIC_ variables into the app’s JavaScript. A secret key belongs on a server only.' },
        { text: 'Yes: .env files are secret', why: 'The .env file stays on your computer, but its EXPO_PUBLIC_ values are copied into the app.' },
        { text: 'Yes, if the GitHub repository is private', why: 'The app itself carries the value to every phone that installs it.' },
      ],
    },
  ],
  hints: [
    'Ask: where does the value end up? A plain file, an encrypted store, a log, or the app’s code?',
    'AsyncStorage is plain text on disk. SecureStore is encrypted with a key the phone protects.',
    'Logs and EXPO_PUBLIC_ variables leave the phone or go to everyone: never put secrets there.',
  ],
  solution: {
    explain: 'A secret is safe only where it is encrypted (SecureStore) or never on the phone at all (a secret key stays on a server).',
    text: '1 · Yes: AsyncStorage is plain text — 2 · No: SecureStore is encrypted — 3 · The token leaks into logs — 4 · No: EXPO_PUBLIC_ values are built into the app',
  },
  success: 'Rule of thumb: tokens go to **SecureStore**, passwords are never stored, logs never contain secrets, and secret keys never enter the app.',
};

/* --------------------------------------------------------------- Exercise 8 */

const TOKEN_STARTER = `import * as SecureStore from 'expo-secure-store';

// SecureStore keys may use letters, numbers, ".", "-" and "_" (no spaces)
const TOKEN_KEY = 'auth.token';

// 1. Save the token (encrypted in the Keychain / Keystore)
export async function saveToken(token: string) {
}

// 2. Read it back: the token, or null when there is none
export async function getToken(): Promise<string | null> {
  return null;
}

// 3. Delete it (signing out)
export async function deleteToken() {
}
`;

export const TOKEN_SOLUTION = `import * as SecureStore from 'expo-secure-store';

// SecureStore keys may use letters, numbers, ".", "-" and "_" (no spaces)
const TOKEN_KEY = 'auth.token';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
`;

const TOKEN_APP = `import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { deleteToken, getToken, saveToken } from './tokenStore';

// A pretend server: it checks the password and answers with a token
async function fakeSignIn(): Promise<string> {
  await new Promise((r) => setTimeout(r, 300));
  return 'eyJhbGciOiJIUzI1NiJ9.student-240001.' + Math.random().toString(36).slice(2, 10);
}

// This screen is ready: it uses the three functions of tokenStore.ts.
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then((saved) => {
      setToken(saved); // signed in again after a restart, if a token was saved
      setLoading(false);
    });
  }, []);

  async function signIn() {
    const t = await fakeSignIn();
    await saveToken(t);
    setToken(t);
  }

  async function signOut() {
    await deleteToken();
    setToken(null);
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-white"><ActivityIndicator /></View>;
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-6">
      <Text className="text-2xl font-bold text-slate-900">{token ? 'Signed in' : 'Signed out'}</Text>
      <Text className="text-center text-slate-600">{token ? 'The token is saved in SecureStore.' : 'No token is saved.'}</Text>
      {token ? (
        <Pressable testID="sign-out" onPress={signOut} className="rounded-xl bg-slate-200 px-6 py-3">
          <Text className="font-semibold text-slate-900">Sign out</Text>
        </Pressable>
      ) : (
        <Pressable testID="sign-in" onPress={signIn} className="rounded-xl bg-indigo-600 px-6 py-3">
          <Text className="font-semibold text-white">Sign in</Text>
        </Pressable>
      )}
    </View>
  );
}
`;

export const ex08: CodeExercise = {
  id: id('token-store'),
  n: 8,
  title: 'A token service with SecureStore',
  minutes: 7,
  level: 4,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  freshDevice: true,
  prompt: 'Write the three functions of **tokenStore.ts** with **SecureStore**: save, read and delete the token. Then sign in, press **Restart app** (still signed in), and sign out (the token is gone). In Device storage the token shows only as encrypted bytes.',
  files: { 'tokenStore.ts': TOKEN_STARTER, 'App.tsx': TOKEN_APP },
  checks: [
    {
      id: 'api',
      label: 'uses `setItemAsync`, `getItemAsync` and `deleteItemAsync` with TOKEN_KEY',
      fail: 'One line each: `SecureStore.setItemAsync(TOKEN_KEY, token)`, `SecureStore.getItemAsync(TOKEN_KEY)`, `SecureStore.deleteItemAsync(TOKEN_KEY)`.',
      static: (c) => {
        const src = code(c.files, 'tokenStore.ts');
        return ['setItemAsync', 'getItemAsync', 'deleteItemAsync'].every((fn) => new RegExp(`SecureStore\\s*\\.\\s*${fn}\\s*\\(\\s*TOKEN_KEY`).test(src));
      },
    },
    {
      id: 'no-plain',
      label: 'the token never goes to AsyncStorage or the console',
      fail: 'Keep the token out of AsyncStorage and out of `console.log`: both can be read outside the app.',
      static: (c) => {
        const src = allCode(c.files);
        if (/@react-native-async-storage\/async-storage/.test(src)) return 'AsyncStorage is a plain file: a token must not be stored there. Use SecureStore only.';
        if (/console\.(log|info|warn)\s*\([^)]*token/i.test(src)) return 'Remove the `console.log` with the token: logs are copied to tools and crash reports.';
        return true;
      },
    },
    {
      id: 'save',
      label: 'Sign in saves the token in SecureStore',
      fail: '`saveToken` should run `await SecureStore.setItemAsync(TOKEN_KEY, token);`',
      run: async (c) => {
        await waitForText(c.app, (t) => /Signed out/.test(t), 3000);
        await c.app.press({ testID: 'sign-in' });
        await waitForText(c.app, (t) => /Signed in/.test(t), 3000);
        const keys = await until(c.app, () => secureKeys(c.app), (k) => k.includes('auth.token'), 3000);
        return keys.includes('auth.token');
      },
    },
    {
      id: 'restart',
      label: 'after Restart app the user is still signed in',
      fail: '`getToken` should return the saved token: `return SecureStore.getItemAsync(TOKEN_KEY);`',
      run: async (c) => /Signed in/.test(await waitForText(c.app, (t) => /Signed in/.test(t), 3000)),
    },
    {
      id: 'delete',
      label: 'Sign out deletes the token',
      fail: '`deleteToken` should run `await SecureStore.deleteItemAsync(TOKEN_KEY);`',
      run: async (c) => {
        await waitForText(c.app, (t) => /Signed in/.test(t), 3000);
        await c.app.press({ testID: 'sign-out' });
        await waitForText(c.app, (t) => /Signed out/.test(t), 3000);
        const keys = await until(c.app, () => secureKeys(c.app), (k) => !k.includes('auth.token'), 3000);
        return !keys.includes('auth.token');
      },
    },
  ],
  hints: [
    'Saving: `await SecureStore.setItemAsync(TOKEN_KEY, token);`',
    'Reading: `return SecureStore.getItemAsync(TOKEN_KEY);` — it gives the token, or `null`.',
    'Deleting: `await SecureStore.deleteItemAsync(TOKEN_KEY);` Then try Sign in → Restart app → Sign out.',
  ],
  solution: {
    explain: 'Each function is one SecureStore call with the same key. The screen reads the token when it opens, so a saved token signs the user in again after a restart.',
    files: { 'tokenStore.ts': TOKEN_SOLUTION },
  },
  success: 'The same three calls are all a real app needs for a token. Keep the limits in mind: SecureStore protects the token **on the phone**; it does not decide what the user may do. The server does that (Part 5: Row Level Security).',
};
