// Reference solutions and typical mistakes for Lab 03 code exercises.
// Lives with the tests (never imported by the site), so students can't find answers in the page's JavaScript.
import { ex02, ex04, ex05 } from '../../src/lab/exercises/lab-03/part1.ts';
import { ex08, ex10, ex12, ex13 } from '../../src/lab/exercises/lab-03/part2.ts';
import { ex15 } from '../../src/lab/exercises/lab-03/part3.ts';

type Files = Record<string, string>;
const PROFILE = 'src/features/profile/screens/ProfileScreen.tsx';

export const solutions: Record<string, Files> = {
  [ex02.id]: {
    'App.tsx': `import { View, Text } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 justify-center bg-slate-950 p-6">
      <View className="gap-4 rounded-3xl border border-slate-700 bg-slate-900 p-6">
        <Text className="text-xs font-bold uppercase tracking-widest text-emerald-300">Semester app</Text>
        <Text className="text-3xl font-bold text-white">Campus Companion</Text>
        <Text className="text-base leading-6 text-slate-300">Find events, places and activities around campus.</Text>
        <Text className="self-start rounded-full bg-emerald-300 px-4 py-2 font-bold text-slate-950">Start exploring</Text>
      </View>
    </View>
  );
}`,
  },
  [ex04.id]: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

export default function App() {
  const [saved, setSaved] = useState(false);
  return (
    <View className="flex-1 justify-center bg-slate-950 p-6">
      <View className="gap-4 rounded-2xl bg-slate-900 p-5">
        <Text className="text-xl font-bold text-white">Architecture notes</Text>
        <Pressable accessibilityRole="button" onPress={() => setSaved(true)} className="self-start rounded-xl bg-emerald-300 px-4 py-3 active:opacity-70">
          <Text className="font-bold text-slate-950">{saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}`,
  },
  [ex05.id]: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

type Props = { label: string; onPress: () => void; disabled?: boolean };

function AppButton({ label, onPress, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="rounded-xl bg-emerald-300 px-5 py-3 active:opacity-70 disabled:opacity-40"
    >
      <Text className="font-bold text-slate-950">{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [booked, setBooked] = useState(0);
  const [waitlist, setWaitlist] = useState(0);
  return (
    <View className="flex-1 justify-center gap-4 bg-slate-950 p-6">
      <Text className="text-xl font-bold text-white">Campus Fair · Hall B</Text>
      <Text className="text-slate-300">Booked: {booked} · Waitlist: {waitlist}</Text>
      <AppButton label="Book a seat" onPress={() => setBooked(booked + 1)} />
      <AppButton label="Join waitlist" disabled onPress={() => setWaitlist(waitlist + 1)} />
    </View>
  );
}`,
  },
  [ex08.id]: {
    ...ex08.files,
    [PROFILE]: ex08.files[PROFILE]
      .replace("import { AppButton } from '../../../components/ui/AppButton';", "import { AppButton } from '@/components/ui/AppButton';")
      .replace("import { colors } from '../../../theme/tokens';", "import { colors } from '@/theme/tokens';"),
  },
  [ex10.id]: {
    'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { View, Text, Pressable } from 'react-native';

const EVENTS = [
  { id: 'e41', title: 'Coding night' },
  { id: 'e42', title: 'Campus Fair' },
];

type RootStackParamList = {
  Home: undefined;
  Details: { itemId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  return (
    <View className="flex-1 gap-3 bg-white p-6">
      {EVENTS.map((event) => (
        <Pressable key={event.id} onPress={() => navigation.navigate('Details', { itemId: event.id })} className="rounded-xl bg-slate-100 p-4 active:opacity-70">
          <Text className="text-lg font-semibold">{event.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DetailsScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Details'>) {
  return <Text className="p-6 text-2xl font-bold">Event {route.params.itemId}</Text>;
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Events' }} />
        <Stack.Screen name="Details" component={DetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}`,
  },
  [ex12.id]: {
    'App.tsx': ex12.files['App.tsx']
      .replace("          // 3. tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} color={color} size={size} />", '          tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} color={color} size={size} />,')
      .replace('        {/* 1. a Saved tab   2. a Profile tab */}', '        <Tab.Screen name="Saved" component={Saved} />\n        <Tab.Screen name="Profile" component={Profile} />'),
  },
  [ex13.id]: {
    'App.tsx': ex13.files['App.tsx'].replace(
      "<Pressable onPress={() => {}} className=\"rounded-xl bg-emerald-600",
      "<Pressable onPress={() => navigation.navigate('Main', { screen: 'Profile', params: { userId: '42' } })} className=\"rounded-xl bg-emerald-600",
    ),
  },
  [ex15.id]: {
    'App.tsx': `import { View, Text } from 'react-native';

const CONFIG = {
  development: { label: 'DEV', apiUrl: 'http://192.168.1.10:3000', color: '#64748b' },
  staging: { label: 'STAGING', apiUrl: 'https://staging-api.example.com', color: '#d97706' },
  production: { label: 'LIVE', apiUrl: 'https://api.example.com', color: '#059669' },
} as const;

const APP_ENV: keyof typeof CONFIG = 'staging';

export default function App() {
  const env = CONFIG[APP_ENV];
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white p-6">
      <Text style={{ backgroundColor: env.color }} className="rounded-full px-3 py-1 font-bold text-white">{env.label}</Text>
      <Text className="text-2xl font-bold">Campus Companion</Text>
      <Text className="font-mono text-slate-500">{env.apiUrl}</Text>
    </View>
  );
}`,
  },
};

type Mistake = { ex: string; name: string; files: Files; fails: string[]; passes?: string[]; message?: RegExp };

export const mistakes: Mistake[] = [
  {
    ex: ex05.id,
    name: 'wraps the label but forgets to pass disabled on',
    files: { 'App.tsx': solutions[ex05.id]['App.tsx'].replace('      disabled={disabled}\n', '') },
    fails: ['disabled'],
    passes: ['text', 'works', 'role'],
  },
  {
    ex: ex10.id,
    name: 'navigates without the itemId',
    files: { 'App.tsx': solutions[ex10.id]['App.tsx'].replace("navigation.navigate('Details', { itemId: event.id })", "navigation.navigate('Details' as any)") },
    fails: ['open', 'no-any'],
    passes: ['type', 'screen'],
  },
  {
    ex: ex10.id,
    name: 'uses replace, so Back cannot return',
    files: { 'App.tsx': solutions[ex10.id]['App.tsx'].replace("navigation.navigate('Details'", "navigation.replace('Details'") },
    fails: ['back'],
    passes: ['open'],
  },
  {
    ex: ex13.id,
    name: "calls navigate('Profile') from the stack",
    files: { 'App.tsx': solutions[ex13.id]['App.tsx'].replace("navigation.navigate('Main', { screen: 'Profile', params: { userId: '42' } })", "navigation.navigate('Profile', { userId: '42' })") },
    fails: ['shape'],
  },
  {
    ex: ex08.id,
    name: 'converts the same-feature import too',
    files: { ...solutions[ex08.id], [PROFILE]: solutions[ex08.id][PROFILE].replace("from '../api'", "from '@/features/profile/api'") },
    fails: ['relative'],
    passes: ['button', 'tokens', 'no-deep', 'runs'],
  },
  {
    ex: ex15.id,
    name: 'switches to staging but keeps the secret',
    files: { 'App.tsx': ex15.files['App.tsx'].replace("= 'development'", "= 'staging'") },
    fails: ['secret', 'badge'],
    passes: ['staging', 'api'],
  },
  {
    ex: ex12.id,
    name: 'one fixed icon name for every tab',
    files: { 'App.tsx': solutions[ex12.id]['App.tsx'].replace('name={ICONS[route.name]}', 'name="home"') },
    fails: ['per-route'],
    passes: ['saved', 'profile', 'icons', 'tint'],
  },
];
