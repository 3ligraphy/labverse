/** Lab 03 · Blocks 3–4 — feature architecture with @/ aliases, and typed React Navigation. Exercises 6–13. */
import type { CodeExercise, MatchExercise, PredictExercise } from '../types.ts';
import { calls, el, imports, jsxElements } from '../helpers.ts';
import { LAB_ID } from './meta.ts';

const id = (name: string) => `${LAB_ID}--${name}`;
const settle = (c: { app: { wait(ms: number): Promise<void> } }) => c.app.wait(60);

export const ex06: MatchExercise = {
  id: id('folders-match'),
  n: 6,
  title: 'Where does each file live?',
  minutes: 3,
  level: 3,
  kind: 'match',
  mono: true,
  prompt: 'Organize **by feature**, not by file type. Drag each file into the folder that owns it.',
  pairs: [
    { chip: 'LoginScreen.tsx', target: 'src/features/auth/screens/', why: 'A screen belongs to the feature that owns it.' },
    { chip: 'useEvents.ts', target: 'src/features/events/hooks/', why: 'Only the events feature needs this hook, so it lives there.' },
    { chip: 'events api.ts', target: 'src/features/events/', why: 'The calls a feature makes stay next to its screens.' },
    { chip: 'AppButton.tsx', target: 'src/components/ui/', why: 'A shared primitive used by many features, with no business data.' },
    { chip: 'tokens.ts', target: 'src/theme/', why: 'Colours, spacing and radius for the whole app.' },
    { chip: 'RootNavigator.tsx', target: 'src/app/navigation/', why: 'The app shell wires the features together.' },
    { chip: 'httpClient.ts', target: 'src/services/', why: 'Shared infrastructure every feature’s api.ts can use.' },
  ],
  decoys: [{ chip: 'utils-final-2.ts', why: 'A dumping-ground name hides who owns the code. Name a file after what it does and keep it with its feature.' }],
  hints: [
    'Ask: “which feature would break if I deleted this file?” — it lives in that feature.',
    'If several features use it and it has no business logic, it is shared: `components/ui`, `theme` or `services`.',
    'One file name is a smell, not a location.',
  ],
  success: 'A teammate looking for “the events code” now opens one folder. Shared code stays small and generic, and features stay independent.',
};

export const ex07: PredictExercise = {
  id: id('imports-predict'),
  n: 7,
  title: 'Which imports are allowed?',
  minutes: 3,
  level: 4,
  kind: 'predict',
  prompt: 'One rule keeps the architecture healthy: **features may use shared code; shared code never imports a feature.** Judge each import.',
  questions: [
    {
      code: `// src/features/events/screens/EventList.tsx
import { AppButton } from '@/components/ui/AppButton';`,
      question: 'Is this import OK?',
      options: [
        { text: 'Yes: a feature uses a shared primitive', correct: true, why: 'Exactly what shared UI is for.' },
        { text: 'No: features must not import anything outside their folder', why: 'They may use shared code — just not other features’ internals.' },
      ],
    },
    {
      code: `// src/components/ui/AppButton.tsx
import { useEvents } from '@/features/events/hooks/useEvents';`,
      question: 'Is this import OK?',
      options: [
        { text: 'Yes: the button can show event data', why: 'Then AppButton only works where events exist, and it creates an import cycle.' },
        { text: 'No: shared code must not depend on a feature', correct: true, why: 'Shared code points nowhere; features point at shared code. That one-way rule prevents cycles.' },
      ],
    },
    {
      code: `// src/features/profile/screens/ProfileScreen.tsx
import { updateProfile } from '../api';`,
      question: 'Should this be rewritten with @/?',
      options: [
        { text: 'No: inside one feature a short relative path is fine', correct: true, why: 'Relative paths are clear for neighbours. Use `@/` when you cross a boundary.' },
        { text: 'Yes: every import must use @/', why: 'Both work; the rule of thumb is `@/` across boundaries, relative within a feature.' },
      ],
    },
    {
      code: `// src/features/profile/screens/ProfileScreen.tsx
import { EventCard } from '../../events/components/EventCard';`,
      question: 'What is the best fix?',
      options: [
        { text: 'Leave it: it works', why: 'It works today, but profile now depends on the inside of another feature.' },
        { text: 'Move EventCard to src/components (or export it from the events feature) and import it with @/', correct: true, why: 'If two features need it, it is shared — make that explicit.' },
      ],
    },
  ],
  hints: [
    'Arrows only point one way: feature → shared.',
    'Relative inside a feature, `@/` across boundaries.',
    'If two features need the same component, it is not owned by either of them.',
  ],
  success: 'These four rules are your architecture review. Run them on your own repository before you commit Sprint 01.',
};

const PROFILE = `import { useState } from 'react';
import { View, Text } from 'react-native';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme/tokens';
import { updateProfile } from '../api';

// 1. Replace the two ../../../ imports with @/ aliases.
// 2. Keep '../api' as it is: it is in the same feature.

export default function ProfileScreen() {
  const [saved, setSaved] = useState(false);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.background }}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Mariam Ahmed</Text>
      <AppButton
        label={saved ? 'Saved ✓' : 'Save profile'}
        onPress={async () => {
          await updateProfile('Mariam Ahmed');
          setSaved(true);
        }}
      />
    </View>
  );
}
`;

export const ex08: CodeExercise = {
  id: id('alias-code'),
  n: 8,
  title: 'Replace fragile paths with @/',
  minutes: 4,
  level: 4,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'In `ProfileScreen.tsx`, replace the `../../../` imports with `@/` aliases (`@/*` → `src/*`). Keep the import from the same feature relative.',
  files: {
    'src/features/profile/screens/ProfileScreen.tsx': PROFILE,
    'App.tsx': `import ProfileScreen from '@/features/profile/screens/ProfileScreen';

export default function App() {
  return <ProfileScreen />;
}
`,
    'src/components/ui/AppButton.tsx': `import { Pressable, Text } from 'react-native';

type Props = { label: string; onPress: () => void };

export function AppButton({ label, onPress }: Props) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="items-center rounded-xl bg-emerald-300 px-5 py-3 active:opacity-70">
      <Text className="font-bold text-slate-950">{label}</Text>
    </Pressable>
  );
}
`,
    'src/theme/tokens.ts': `export const colors = { background: '#0B1020', surface: '#151C31', text: '#F8FAFC', muted: '#94A3B8', primary: '#7CFFB2' } as const;
`,
    'src/features/profile/api.ts': `export async function updateProfile(name: string) {
  return { ok: true, name };
}
`,
  },
  checks: [
    {
      id: 'button',
      label: '`AppButton` comes from `@/components/ui/AppButton`',
      fail: 'Write `import { AppButton } from \'@/components/ui/AppButton\';`',
      static: (c) => imports(c.file('src/features/profile/screens/ProfileScreen.tsx')).has('@/components/ui/AppButton'),
    },
    {
      id: 'tokens',
      label: '`colors` comes from `@/theme/tokens`',
      fail: 'Write `import { colors } from \'@/theme/tokens\';`',
      static: (c) => imports(c.file('src/features/profile/screens/ProfileScreen.tsx')).has('@/theme/tokens'),
    },
    {
      id: 'no-deep',
      label: 'no `../../../` paths left',
      fail: 'Remove the imports that climb three folders up — they break as soon as a file moves.',
      static: (c) => ![...imports(c.file('src/features/profile/screens/ProfileScreen.tsx')).keys()].some((s) => s.startsWith('../../')),
    },
    {
      id: 'relative',
      label: 'the same-feature import stays relative',
      fail: 'Keep `import { updateProfile } from \'../api\';` — inside one feature, relative is clearer.',
      static: (c) => imports(c.file('src/features/profile/screens/ProfileScreen.tsx')).has('../api'),
    },
    {
      id: 'runs',
      label: 'the screen still works',
      fail: 'Pressing “Save profile” should show “Saved ✓”. Check that every import path is spelled right.',
      run: async (c) => {
        await c.app.rerun();
        await c.app.press({ text: 'Save profile' });
        await settle(c);
        return /Saved ✓/.test(await c.app.text());
      },
    },
  ],
  hints: [
    '`@/` means “from `src/`”, so `../../../components/ui/AppButton` becomes `@/components/ui/AppButton`.',
    'Do the same for the theme: `@/theme/tokens`.',
    'Leave `../api` alone — it is a neighbour in the same feature.',
  ],
  success: 'Now you can move `ProfileScreen.tsx` to any folder and its cross-feature imports still work. In your project, set `"paths": { "@/*": ["src/*"] }` in `tsconfig.json` and restart Metro with `--clear`.',
};

export const ex09: PredictExercise = {
  id: id('navigator-predict'),
  n: 9,
  title: 'Stack, tabs or drawer?',
  minutes: 3,
  level: 3,
  kind: 'predict',
  prompt: 'Choose navigation by **how the user moves**, not to show off every navigator. Pick one for each situation in Campus Companion.',
  questions: [
    {
      code: `// Discover · Saved · Profile
// The user switches between these all day.`,
      question: 'Which navigator?',
      options: [
        { text: 'Bottom tabs', correct: true, why: 'A few equal, top-level areas the user jumps between: tabs keep them one tap away.' },
        { text: 'Stack', why: 'A stack is for going deeper and coming back — not for switching between equals.' },
        { text: 'Drawer', why: 'A drawer hides frequent destinations behind a tap.' },
      ],
    },
    {
      code: `// Tap an event in Discover → see its details → Back`,
      question: 'Which navigator?',
      options: [
        { text: 'Stack', correct: true, why: 'Drill in, then Back: the stack remembers where you came from.' },
        { text: 'Bottom tabs', why: 'Details is not a top-level area.' },
        { text: 'Drawer', why: 'Details depends on which event you tapped.' },
      ],
    },
    {
      code: `// Settings · Help · About · Terms · Privacy
// Opened once in a while.`,
      question: 'Which navigator?',
      options: [
        { text: 'Bottom tabs', why: 'Five rarely used tabs would waste the most valuable space on the screen.' },
        { text: 'Drawer (or a Settings screen in the stack)', correct: true, why: 'Occasional destinations can hide in a menu.' },
      ],
    },
    {
      code: `// Log in → the main app.
// Back must not return to the login screen.`,
      question: 'How do you leave the login screen?',
      options: [
        { text: "navigation.navigate('Main')", why: 'Login stays underneath, so Back shows it again.' },
        { text: "navigation.replace('Main')", correct: true, why: 'Replace swaps the screen, so there is nothing to go back to.' },
      ],
    },
  ],
  hints: [
    'Tabs = a few equal places. Stack = deeper and back. Drawer = occasional places.',
    'Ask: “does this depend on what the user tapped?” If yes, it is a stack screen.',
    '`navigate` keeps history; `replace` swaps the current screen.',
  ],
  success: 'A common shape is `Stack(Auth, MainTabs, Details)`. Nest as little as possible: every navigator adds history and options to reason about.',
};

export const ex10: CodeExercise = {
  id: id('stack-code'),
  n: 10,
  title: 'A typed stack with a route parameter',
  minutes: 7,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Add a **Details** route that needs an `itemId`. Tapping an event opens Details with its id, and Details shows `Event e42`. Type the route once in `RootStackParamList`.',
  files: {
    'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { View, Text, Pressable } from 'react-native';

const EVENTS = [
  { id: 'e41', title: 'Coding night' },
  { id: 'e42', title: 'Campus Fair' },
];

// 1. Add Details: it needs an itemId (string)
type RootStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  return (
    <View className="flex-1 gap-3 bg-white p-6">
      {EVENTS.map((event) => (
        // 2. Open Details with this event's id
        <Pressable key={event.id} onPress={() => {}} className="rounded-xl bg-slate-100 p-4 active:opacity-70">
          <Text className="text-lg font-semibold">{event.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// 3. DetailsScreen: read route.params.itemId and show "Event {itemId}"

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Events' }} />
        {/* 4. Register the Details screen */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
`,
  },
  checks: [
    {
      id: 'type',
      label: '`Details: { itemId: string }` in the param list',
      fail: 'Type the route once: add `Details: { itemId: string };` to `RootStackParamList`.',
      static: (c) => /Details\s*:\s*\{\s*itemId\s*:\s*string\s*;?\s*\}/.test(c.files['App.tsx']),
    },
    {
      id: 'screen',
      label: 'a `Details` screen is registered',
      fail: 'Add `<Stack.Screen name="Details" component={DetailsScreen} />` inside the navigator.',
      static: (c) => el(c.file(), 'Stack.Screen').some((e) => e.attrs.name?.value === 'Details'),
    },
    {
      id: 'open',
      label: 'tapping “Campus Fair” opens Event e42',
      fail: "In `onPress`, call `navigation.navigate('Details', { itemId: event.id })`. Details should show `Event {route.params.itemId}`.",
      run: async (c) => {
        await c.app.rerun();
        await c.app.press({ text: 'Campus Fair' });
        await settle(c);
        return /Event e42/.test(await c.app.text());
      },
    },
    {
      id: 'back',
      label: 'Back returns to the list',
      fail: 'The header’s Back button should return to Events. Open Details with `navigate` (not `replace`).',
      run: async (c) => {
        await c.app.rerun();
        await c.app.press({ text: 'Coding night' });
        await settle(c);
        if (!/Event e41/.test(await c.app.text())) return 'Tapping “Coding night” should show “Event e41” first.';
        await c.app.press({ text: 'Back' });
        await settle(c);
        return /Campus Fair/.test(await c.app.text()) && !/Event e41/.test(await c.app.text());
      },
    },
    {
      id: 'no-any',
      label: 'no `as any` to silence the types',
      fail: 'Never hide a wrong navigation call with `as any`: fix the param list or the call.',
      static: (c) => !/as\s+any/.test(c.files['App.tsx']),
    },
  ],
  hints: [
    'Param list: `Details: { itemId: string };` — `undefined` means “no params”, an object makes them required.',
    "Home: `onPress={() => navigation.navigate('Details', { itemId: event.id })}`.",
    "Details: `function DetailsScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Details'>) { return <Text>Event {route.params.itemId}</Text>; }`",
  ],
  success: 'Typed once, checked everywhere: in your editor, `navigation.navigate(\'Details\')` without an `itemId` is now a red error before the app even runs.',
  challenge: "Pass `source: 'featured'` as an optional param (`source?: 'search' | 'featured'`) and show it under the title.",
};

export const ex11: MatchExercise = {
  id: id('calls-match'),
  n: 11,
  title: 'What does each navigation call do?',
  minutes: 3,
  level: 4,
  kind: 'match',
  mono: true,
  prompt: 'Drag each call onto what it does to the history.',
  pairs: [
    { chip: "navigate('Details', { itemId })", target: 'Opens Details (or returns to it if it is already open)', why: '`navigate` avoids duplicates.' },
    { chip: "push('Details', { itemId })", target: 'Always adds another Details on top, even if one is open', why: 'Useful for “related item → related item”.' },
    { chip: 'goBack()', target: 'Removes the current screen and returns to the previous one', why: 'The header’s Back button calls this.' },
    { chip: "replace('Main')", target: 'Swaps the current screen, so Back can’t return to it', why: 'Use it after login or onboarding.' },
    { chip: 'openDrawer()', target: 'Slides the side menu in', why: 'Only inside a drawer navigator.' },
    { chip: "navigate('Main', { screen: 'Profile' })", target: 'Opens a screen inside a nested navigator', why: 'The outer name, then the inner screen.' },
  ],
  hints: [
    '`navigate` and `push` differ only when the screen is already open.',
    '`replace` is the one that changes history without adding to it.',
    'The `{ screen: … }` form targets a navigator inside another one.',
  ],
  success: 'You can now read any navigation code and say what the Back button will do — the question users care about.',
};

export const ex12: CodeExercise = {
  id: id('tabs-code'),
  n: 12,
  title: 'Bottom tabs with icons',
  minutes: 5,
  level: 5,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Finish the tab bar: add **Saved** and **Profile** tabs, and give every tab its own Ionicons icon.',
  files: {
    'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';

const Tab = createBottomTabNavigator();

function Screen({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold">{title}</Text>
    </View>
  );
}
const Discover = () => <Screen title="Discover events" />;
const Saved = () => <Screen title="Saved events" />;
const Profile = () => <Screen title="Your profile" />;

const ICONS = { Discover: 'search', Saved: 'bookmark', Profile: 'person' } as const;

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#059669',
          // 3. tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} color={color} size={size} />
        })}
      >
        <Tab.Screen name="Discover" component={Discover} />
        {/* 1. a Saved tab   2. a Profile tab */}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
`,
  },
  checks: [
    {
      id: 'saved',
      label: 'a Saved tab',
      fail: 'Add `<Tab.Screen name="Saved" component={Saved} />`.',
      run: async (c) => {
        await c.app.rerun();
        if (!(await c.app.press({ text: 'Saved' }))) return 'I can’t find a “Saved” tab in the tab bar.';
        await settle(c);
        return /Saved events/.test(await c.app.text());
      },
    },
    {
      id: 'profile',
      label: 'a Profile tab',
      fail: 'Add `<Tab.Screen name="Profile" component={Profile} />`.',
      run: async (c) => {
        await c.app.rerun();
        if (!(await c.app.press({ text: 'Profile' }))) return 'I can’t find a “Profile” tab in the tab bar.';
        await settle(c);
        return /Your profile/.test(await c.app.text());
      },
    },
    {
      id: 'icons',
      label: 'every tab has an icon',
      fail: 'In `screenOptions`, add `tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} color={color} size={size} />`.',
      static: (c) => /tabBarIcon/.test(c.files['App.tsx']) && el(c.file(), 'Ionicons').length > 0,
    },
    {
      id: 'per-route',
      label: 'each tab gets its own icon',
      fail: 'Pick the icon from the route: `name={ICONS[route.name]}`, not one fixed name.',
      static: (c) => el(c.file(), 'Ionicons').some((e) => e.attrs.name?.kind === 'expression' && e.attrs.name.value === undefined),
    },
    {
      id: 'tint',
      label: 'the icon follows the tab colour',
      fail: 'Pass the colour the navigator gives you: `color={color}` — then the active tab is green.',
      static: (c) => el(c.file(), 'Ionicons').some((e) => e.attrs.color?.code === 'color'),
    },
  ],
  hints: [
    'Copy the Discover line twice and change `name` and `component`.',
    '`tabBarIcon` is a function the navigator calls with `{ focused, color, size }`.',
    'Inside `screenOptions={({ route }) => ({ … })}`, `route.name` tells you which tab you are drawing.',
  ],
  success: 'Three equal areas, one tap apart, each with a recognisable icon that turns green when active. That is your app’s main shell.',
  challenge: 'Use the `focused` argument to switch between `bookmark` and `bookmark-outline`.',
};

export const ex13: CodeExercise = {
  id: id('exercise-navigation'),
  n: 13,
  title: 'Jump into a nested tab',
  minutes: 5,
  level: 6,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'The app is `Stack(Main tabs, Settings)`. From **Settings**, “View my profile” must open the **Profile tab inside Main** with `userId: \'42\'`.',
  files: {
    'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Pressable } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Feed({ navigation }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white">
      <Text className="text-xl font-bold">Feed</Text>
      <Pressable onPress={() => navigation.navigate('Settings')} className="rounded-xl bg-slate-900 px-4 py-3 active:opacity-70">
        <Text className="font-bold text-white">Open settings</Text>
      </Pressable>
    </View>
  );
}

function Profile({ route }) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold">Profile #{route.params?.userId ?? '—'}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Feed" component={Feed} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

function Settings({ navigation }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white">
      <Text className="text-xl font-bold">Settings</Text>
      {/* Open the Profile tab inside Main, with userId '42' */}
      <Pressable onPress={() => {}} className="rounded-xl bg-emerald-600 px-4 py-3 active:opacity-70">
        <Text className="font-bold text-white">View my profile</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={Settings} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
`,
  },
  checks: [
    {
      id: 'nested',
      label: 'opens the Profile tab with userId 42',
      fail: "Navigate to the outer screen, then the inner one: `navigation.navigate('Main', { screen: 'Profile', params: { userId: '42' } })`.",
      run: async (c) => {
        await c.app.rerun();
        await c.app.press({ text: 'Open settings' });
        await settle(c);
        await c.app.press({ text: 'View my profile' });
        await settle(c);
        return /Profile #42/.test(await c.app.text());
      },
    },
    {
      id: 'shape',
      label: 'uses the `{ screen, params }` form',
      fail: "Use `navigate('Main', { screen: 'Profile', params: { … } })` — `navigate('Profile')` only works from inside the tabs.",
      static: (c) => calls(c.file(), 'navigate').some((call) => /['"]Main['"]/.test(call.code) && /screen\s*:\s*['"]Profile['"]/.test(call.code)),
    },
    {
      id: 'one-container',
      label: 'still one `NavigationContainer`',
      fail: 'Keep exactly one `<NavigationContainer>` at the root: nested navigators share it.',
      static: (c) => jsxElements(c.file()).filter((e) => e.name === 'NavigationContainer').length === 1,
    },
  ],
  hints: [
    'Settings is in the stack; Profile is inside the `Main` tabs. Name the outer screen first.',
    "The shape is `navigate('Main', { screen: 'Profile', params: { userId: '42' } })`.",
    'Profile reads it with `route.params?.userId` (already written for you).',
  ],
  success: 'Nested navigators feel like one app because names bubble: the stack handles `Main`, then the tabs inside it handle `Profile`.',
};
