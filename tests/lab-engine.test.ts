// The upgraded lab engine: friendly compile errors, the loop guard, React Navigation, expo-router navigation,
// extra packages and NativeWind variants — all rendered in happy-dom like the real preview.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 390, height: 844 });
const { createRuntime } = await import('../src/lab/runtime/core.ts');
const { compileAll, compileFile } = await import('../src/lab/engine/compile.ts');
const { classToStyle, setPlatform } = await import('../src/lab/runtime/tw.ts');

type Msg = { type: string; error?: { message: string; hint?: string; file?: string; line?: number } };

function harness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const messages: Msg[] = [];
  const runtime = createRuntime({ container, post: (m) => messages.push(m as Msg) });
  let id = 0;
  async function run(files: Record<string, string>, entry = 'App.tsx', frame: 'phone' | 'web' = 'phone') {
    const compiled = compileAll(files);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));
    messages.length = 0;
    await runtime.run({ type: 'run', id: ++id, files: compiled.files, entry, frame });
    await new Promise((r) => setTimeout(r, 30));
    return { rendered: messages.some((m) => m.type === 'rendered'), error: messages.find((m) => m.type === 'error')?.error };
  }
  return { run, d: runtime.driver };
}
const tick = () => new Promise((r) => setTimeout(r, 30));

test('syntax errors are explained in plain words, on the right line', () => {
  const tag = compileFile('App.tsx', `import { View, Text } from 'react-native';\nexport default function App() {\n  return <View>\n    <Text>Hi</View>;\n}`);
  assert.equal(tag.ok, false);
  if (!tag.ok) {
    assert.match(tag.error.message, /<Text>.*closed with/);
    assert.match(tag.error.hint ?? '', /<\/Text>/);
    assert.equal(tag.error.line, 4);
  }
  const two = compileFile('App.tsx', `export default function App() {\n  return <Text>A</Text>\n  <Text>B</Text>;\n}`);
  assert.equal(two.ok, false);
  const comma = compileFile('App.tsx', `const items = ['a' 'b'];`);
  assert.equal(comma.ok, false);
  if (!comma.ok) assert.match(`${comma.error.message} ${comma.error.hint}`, /comma|","/);
  const str = compileFile('App.tsx', `const s = 'open;\n`);
  assert.equal(str.ok, false);
  if (!str.ok) assert.match(str.error.message, /string is never closed/);
  // a .ts file may use <T> casts (no JSX there)
  assert.equal(compileFile('util.ts', 'export const n = <number>(1 as unknown);').ok, true);
});

test('a loop that never ends is stopped with a clear message instead of freezing', async () => {
  const { run } = harness();
  const started = Date.now();
  const r = await run({ 'App.tsx': `export default function App() {\n  let i = 0;\n  while (i < 10) { }\n  return null;\n}` });
  assert.ok(Date.now() - started < 6000);
  assert.match(r.error?.message ?? '', /loop on line 3 never stopped/);
});

test('long but finite loops still run', async () => {
  const { run, d } = harness();
  await run({ 'App.tsx': `import { Text } from 'react-native';\nexport default function App() {\n  let n = 0;\n  for (let i = 0; i < 300000; i++) n += i % 3;\n  return <Text>{'n=' + n}</Text>;\n}` });
  assert.match(await d.text(), /n=300000/);
});

test('React Navigation: a typed stack passes params and goes back', async () => {
  const { run, d } = harness();
  const r = await run({
    'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { View, Text, Pressable } from 'react-native';
type RootStackParamList = { Home: undefined; Details: { itemId: string } };
const Stack = createNativeStackNavigator<RootStackParamList>();
function Home({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  return <View><Pressable onPress={() => navigation.navigate('Details', { itemId: '42' })}><Text>Open details</Text></Pressable></View>;
}
function Details({ route }: NativeStackScreenProps<RootStackParamList, 'Details'>) {
  return <Text>Item {route.params.itemId}</Text>;
}
export default function App() {
  return <NavigationContainer><Stack.Navigator><Stack.Screen name="Home" component={Home} options={{ title: 'Campus' }} /><Stack.Screen name="Details" component={Details} /></Stack.Navigator></NavigationContainer>;
}`,
  });
  assert.equal(r.error, undefined);
  assert.match(await d.text(), /Campus/);
  await d.press({ text: 'Open details' });
  await tick();
  assert.match(await d.text(), /Item 42/);
  await d.press({ text: '‹ Back' });
  await tick();
  assert.doesNotMatch(await d.text(), /Item 42/);
  assert.match(await d.text(), /Open details/);
});

test('React Navigation: tabs switch and a nested navigate reaches the inner screen', async () => {
  const { run, d } = harness();
  await run({
    'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text, Pressable } from 'react-native';
const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
function Feed({ navigation }) { return <Pressable onPress={() => navigation.navigate('Settings')}><Text>Go to settings</Text></Pressable>; }
function Profile({ route }) { return <Text>Profile of {route.params?.userId ?? 'nobody'}</Text>; }
function Main() {
  return <Tabs.Navigator screenOptions={({ route }) => ({ tabBarIcon: ({ color }) => <Ionicons name={route.name === 'Feed' ? 'home' : 'person'} color={color} size={20} /> })}>
    <Tabs.Screen name="Feed" component={Feed} />
    <Tabs.Screen name="Profile" component={Profile} />
  </Tabs.Navigator>;
}
function Settings({ navigation }) { return <Pressable onPress={() => navigation.navigate('Main', { screen: 'Profile', params: { userId: '7' } })}><Text>Open my profile</Text></Pressable>; }
export default function App() {
  return <NavigationContainer><Stack.Navigator><Stack.Screen name="Main" component={Main} options={{ headerShown: false }} /><Stack.Screen name="Settings" component={Settings} /></Stack.Navigator></NavigationContainer>;
}`,
  });
  assert.match(await d.text(), /Go to settings/);
  await d.press({ text: 'Profile' });
  await tick();
  assert.match(await d.text(), /Profile of nobody/);
  await d.press({ text: 'Feed' });
  await tick();
  await d.press({ text: 'Go to settings' });
  await tick();
  await d.press({ text: 'Open my profile' });
  await tick();
  assert.match(await d.text(), /Profile of 7/);
});

test('React Navigation: the drawer opens from the header and switches screens', async () => {
  const { run, d } = harness();
  await run({
    'App.tsx': `import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Text } from 'react-native';
const Drawer = createDrawerNavigator();
const Home = () => <Text>Home screen</Text>;
const Help = () => <Text>Help screen</Text>;
export default function App() {
  return <NavigationContainer><Drawer.Navigator><Drawer.Screen name="Home" component={Home} /><Drawer.Screen name="Help" component={Help} options={{ drawerLabel: 'Help centre' }} /></Drawer.Navigator></NavigationContainer>;
}`,
  });
  assert.match(await d.text(), /Home screen/);
  await d.press({ text: '☰' });
  await tick();
  await d.press({ text: 'Help centre' });
  await tick();
  assert.match(await d.text(), /Help screen/);
});

test('a navigator without NavigationContainer explains what is missing', async () => {
  const { run } = harness();
  const r = await run({
    'App.tsx': `import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
const Stack = createNativeStackNavigator();
export default function App() { return <Stack.Navigator><Stack.Screen name="A" component={() => <Text>A</Text>} /></Stack.Navigator>; }`,
  });
  assert.match(r.error?.message ?? '', /NavigationContainer/);
});

test('expo-router: <Link> opens a [param] screen and the header goes back', async () => {
  const { run, d } = harness();
  const r = await run(
    {
      'app/_layout.tsx': `import { Stack } from 'expo-router';\nexport default function Layout() { return <Stack />; }`,
      'app/index.tsx': `import { Link } from 'expo-router';\nimport { View } from 'react-native';\nexport default function Home() { return <View><Link href="/movie/3">Open movie 3</Link></View>; }`,
      'app/movie/[id].tsx': `import { useLocalSearchParams } from 'expo-router';\nimport { Text } from 'react-native';\nexport default function Movie() { const { id } = useLocalSearchParams(); return <Text>Movie {id}</Text>; }`,
    },
    'app/_layout.tsx',
  );
  assert.equal(r.error, undefined);
  await d.press({ text: 'Open movie 3' });
  await tick();
  assert.match(await d.text(), /Movie 3/);
  await d.press({ text: 'Back' });
  await tick();
  assert.match(await d.text(), /Open movie 3/);
});

test('process.env, Platform, icons, gradients and AsyncStorage work in the preview', async () => {
  const { run, d } = harness();
  const r = await run({
    'App.tsx': `import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
export default function App() {
  const [saved, setSaved] = useState('');
  useEffect(() => { AsyncStorage.setItem('k', 'stored').then(() => AsyncStorage.getItem('k')).then((v) => setSaved(v ?? '')); }, []);
  return <LinearGradient colors={['#000', '#333']}><View>
    <Text>{process.env.EXPO_PUBLIC_APP_ENV}</Text><Text>{Platform.OS}</Text><Text>{saved}</Text><Feather name="star" size={16} color="gold" />
  </View></LinearGradient>;
}`,
  });
  assert.equal(r.error, undefined);
  await tick();
  const text = await d.text();
  assert.match(text, /development/);
  assert.match(text, /ios/);
  assert.match(text, /stored/);
  assert.match(text, /★/);
});

test('NativeWind: platform and disabled variants, space-y, transforms and arbitrary values', () => {
  setPlatform('phone');
  const phone = classToStyle('pt-2 ios:pt-4 android:pt-8 web:pt-1 dark:bg-black space-y-3 -translate-y-1 rotate-45 rounded-[10px] tracking-[2px] max-w-[300px] disabled:opacity-40');
  assert.deepEqual(phone.unknown, []);
  assert.equal(phone.style.paddingTop, 16);
  assert.equal(phone.style.rowGap, 12);
  assert.deepEqual(phone.style.transform, [{ translateY: -4 }, { rotate: '45deg' }]);
  assert.equal(phone.style.borderRadius, 10);
  assert.equal(phone.style.letterSpacing, 2);
  assert.equal(phone.style.maxWidth, 300);
  assert.equal(phone.style.backgroundColor, undefined);
  assert.deepEqual(phone.disabled, { opacity: 0.4 });
  setPlatform('web');
  assert.equal(classToStyle('pt-2 ios:pt-4 web:pt-1').style.paddingTop, 4);
  setPlatform('phone');
  assert.deepEqual(classToStyle('ios:bg-nope-500').unknown, ['ios:bg-nope-500']);
});
