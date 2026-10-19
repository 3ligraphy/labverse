/** Lab 03 live demos — editable, not graded. */
import type { Demo } from '../types.ts';

export const demos: Record<string, Demo> = {
  imports: {
    id: 'imports',
    title: 'Both kinds of import in one real screen',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'src/features/profile/screens/ProfileScreen.tsx': `import { useState } from 'react';
import { View, Text } from 'react-native';

// @/  = start at src/      →  src/components/ui/AppButton.tsx
import { AppButton } from '@/components/ui/AppButton';
// @/  = start at src/      →  src/theme/tokens.ts
import { colors } from '@/theme/tokens';
// ../ = up one folder (screens/ → profile/), then api.ts  →  src/features/profile/api.ts
import { updateProfile } from '../api';

export default function ProfileScreen() {
  const [saved, setSaved] = useState(false);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.background }}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Mariam Ahmed</Text>
      <AppButton label={saved ? 'Saved ✓' : 'Save profile'} onPress={async () => { await updateProfile('Mariam'); setSaved(true); }} />
    </View>
  );
}
`,
      'App.tsx': `// App.tsx is at the root, so it uses @/ too
import ProfileScreen from '@/features/profile/screens/ProfileScreen';

export default function App() {
  return <ProfileScreen />;
}
`,
      'src/features/profile/api.ts': `// lives next to the profile screens: src/features/profile/api.ts
export async function updateProfile(name: string) {
  return { ok: true, name };
}
`,
      'src/components/ui/AppButton.tsx': `import { Pressable, Text } from 'react-native';

// shared by every feature: src/components/ui/AppButton.tsx
export function AppButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="items-center rounded-xl bg-emerald-300 px-5 py-3 active:opacity-70">
      <Text className="font-bold text-slate-950">{label}</Text>
    </Pressable>
  );
}
`,
      'src/theme/tokens.ts': `// one place for colours: src/theme/tokens.ts
export const colors = { background: '#0B1020', text: '#F8FAFC', primary: '#7CFFB2' } as const;
`,
    },
    tryThis: [
      "Change `'../api'` to `'./api'` and read the error: there is no api.ts inside screens/",
      "Change `'@/theme/tokens'` to `'../../../theme/tokens'`: same file, a longer path",
      "Change `'@/theme/tokens'` to `'@/theme/colors'`: the error names the missing file",
    ],
  },

  'first-stack': {
    id: 'first-stack',
    title: 'Your first navigator: two screens, one parameter',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Pressable } from 'react-native';

// 1. create a stack navigator
const Stack = createNativeStackNavigator();

// 2. screen one: the navigator gives it "navigation"
function HomeScreen({ navigation }) {
  return (
    <View className="flex-1 gap-3 bg-white p-6">
      <Pressable
        onPress={() => navigation.navigate('Details', { itemId: 'e42' })}
        className="rounded-xl bg-emerald-100 p-4 active:opacity-70"
      >
        <Text className="text-lg font-semibold">Campus Fair →</Text>
      </Pressable>
    </View>
  );
}

// 3. screen two: the navigator gives it "route", with the params Home sent
function DetailsScreen({ route }) {
  return <Text className="p-6 text-2xl font-bold">Event {route.params.itemId}</Text>;
}

// 4. put it together: container → navigator → screens
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Events' }} />
        <Stack.Screen name="Details" component={DetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
`,
    },
    tryThis: [
      'Tap “Campus Fair”, then the header’s Back',
      "Send `{ itemId: 'e99' }` instead and tap again",
      "Misspell `'Details'` only inside navigate(…) and read the console",
      'Add a third screen “Map” and a second button that opens it',
    ],
  },

  'ui-system': {
    id: 'ui-system',
    title: 'A small UI system: tokens, a primitive and a screen',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { View, Text } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { EventCard } from '@/features/events/components/EventCard';

export default function App() {
  return (
    <View className="flex-1 gap-4 bg-slate-950 px-5 pt-14">
      <Text className="text-xs font-bold uppercase tracking-widest text-emerald-300">This week</Text>
      <Text className="text-3xl font-bold text-white">Discover</Text>
      <EventCard title="Campus Fair" place="Hall B · Thu 12:00" />
      <EventCard title="Coding night" place="Lab 3 · Wed 18:00" saved />
      <AppButton label="See all events" onPress={() => console.log('open list')} />
      <AppButton label="Create event" variant="ghost" disabled onPress={() => {}} />
    </View>
  );
}
`,
      'src/components/ui/AppButton.tsx': `import { Pressable, Text } from 'react-native';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'ghost'; disabled?: boolean };

// A shared primitive: the look, the feedback, the state and the accessibility live here.
export function AppButton({ label, onPress, variant = 'primary', disabled = false }: Props) {
  const look = variant === 'primary' ? 'bg-emerald-300' : 'border border-emerald-300';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={\`min-h-12 items-center justify-center rounded-xl px-5 active:opacity-70 disabled:opacity-40 \${look}\`}
    >
      <Text className={variant === 'primary' ? 'font-bold text-slate-950' : 'font-bold text-emerald-300'}>{label}</Text>
    </Pressable>
  );
}
`,
      'src/features/events/components/EventCard.tsx': `import { View, Text } from 'react-native';

// A feature component: it knows what an event is. It lives with the events feature.
export function EventCard({ title, place, saved = false }: { title: string; place: string; saved?: boolean }) {
  return (
    <View className="gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-white">{title}</Text>
        {saved && <Text className="rounded-full bg-emerald-300 px-2 py-0.5 text-xs font-bold text-slate-950">Saved</Text>}
      </View>
      <Text className="text-slate-400">{place}</Text>
    </View>
  );
}
`,
      'src/theme/tokens.ts': `// One place for the design language. Screens use classes; native code can read these values.
export const colors = { background: '#020617', surface: '#0f172a', text: '#f8fafc', muted: '#94a3b8', primary: '#6ee7b7', danger: '#fb7185' } as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, pill: 999 } as const;
`,
    },
    tryThis: [
      'Change `rounded-2xl` in EventCard — both cards change: that is the point of a shared component',
      'Remove `disabled` from “Create event” and press it',
      'Add `variant="ghost"` to “See all events”',
    ],
  },

  'campus-shell': {
    id: 'campus-shell',
    title: 'Campus Companion shell: tabs + a stack',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable } from 'react-native';

type RootStackParamList = { Main: undefined; Details: { itemId: string; source?: 'featured' | 'search' } };
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const EVENTS = [
  { id: 'e41', title: 'Coding night', place: 'Lab 3' },
  { id: 'e42', title: 'Campus Fair', place: 'Hall B' },
];

function Discover({ navigation }) {
  return (
    <View className="flex-1 gap-3 bg-white p-5">
      {EVENTS.map((e) => (
        <Pressable key={e.id} onPress={() => navigation.navigate('Details', { itemId: e.id, source: 'featured' })} className="rounded-xl bg-slate-100 p-4 active:opacity-70">
          <Text className="text-lg font-semibold">{e.title}</Text>
          <Text className="text-slate-500">{e.place}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const Saved = () => <View className="flex-1 items-center justify-center bg-white"><Text className="text-slate-500">No saved events yet</Text></View>;
const Profile = () => <View className="flex-1 items-center justify-center bg-white"><Text className="text-xl font-bold">Mariam Ahmed</Text></View>;

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarActiveTintColor: '#059669',
      tabBarIcon: ({ color, size }) => <Ionicons name={{ Discover: 'search', Saved: 'bookmark', Profile: 'person' }[route.name]} color={color} size={size} />,
    })}>
      <Tab.Screen name="Discover" component={Discover} />
      <Tab.Screen name="Saved" component={Saved} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

function Details({ route }: NativeStackScreenProps<RootStackParamList, 'Details'>) {
  const event = EVENTS.find((e) => e.id === route.params.itemId);
  return (
    <View className="flex-1 gap-2 bg-white p-6">
      <Text className="text-2xl font-bold">{event?.title}</Text>
      <Text className="text-slate-500">{event?.place} · opened from {route.params.source}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Details" component={Details} options={{ title: 'Event' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
`,
    },
    tryThis: [
      'Tap an event, then Back — the stack remembers where you were',
      'Switch tabs, then open an event from Discover again',
      "Change `navigate` to `push` and open the same event twice: count the Backs",
    ],
  },
};
