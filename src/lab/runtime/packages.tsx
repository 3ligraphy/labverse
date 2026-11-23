/**
 * Expo / community packages the lab previews provide besides react-native and the navigators, so
 * the code students copy from the docs runs in the browser too:
 * @expo/vector-icons, expo-linear-gradient, @react-native-async-storage/async-storage, expo-constants,
 * expo-haptics, expo-font, expo-splash-screen, expo-image, react-native-gesture-handler, the storage packages of Lab 06,
 * react-native-screens and react-native-safe-area-context.
 */
import { createElement } from 'react';
import { Image, Text, View } from 'react-native-web';
import * as Navigation from './navigation.tsx';
import { PREVIEW_ENV } from '../engine/guard.ts';
import { axios } from './axios.ts';
import aesjs from 'aes-js';
import * as SQLite from './sqlite.ts';
import { AsyncStorage, decode, encode, ExpoCrypto, ImagePicker, KvStore, MMKVModule, NetInfoModule, SecureStore } from './storage.ts';
import { createClient as createSupabaseClient } from './supabase.ts';
import { SvgModule } from './svg.tsx';

type AnyProps = Record<string, any>;

/* ------------------------------------------------------------------ icons */

/** Icon names → a glyph that takes the icon's colour. Unknown names show a dot. */
const GLYPHS: Record<string, string> = {
  home: '⌂', house: '⌂', search: '⌕', magnify: '⌕', person: '👤', user: '👤', account: '👤', 'person-circle': '👤', people: '👥', users: '👥', group: '👥',
  settings: '⚙', cog: '⚙', gear: '⚙', heart: '♥', star: '★', add: '+', plus: '+', 'add-circle': '⊕', 'plus-circle': '⊕', remove: '−', minus: '−',
  close: '✕', x: '✕', 'close-circle': '⊗', menu: '☰', bars: '☰', 'chevron-forward': '›', 'chevron-right': '›', 'chevron-back': '‹', 'chevron-left': '‹',
  'chevron-down': '⌄', 'chevron-up': '⌃', 'arrow-back': '←', 'arrow-left': '←', 'arrow-forward': '→', 'arrow-right': '→', 'arrow-up': '↑', 'arrow-down': '↓',
  checkmark: '✓', check: '✓', 'checkmark-circle': '✔', 'check-circle': '✔', notifications: '🔔', bell: '🔔', calendar: '📅', 'calendar-outline': '📅',
  map: '🗺', location: '📍', pin: '📍', 'map-marker': '📍', bookmark: '🔖', list: '≡', grid: '▦', apps: '▦', camera: '📷', image: '🖼', images: '🖼',
  trash: '🗑', delete: '🗑', create: '✎', edit: '✎', pencil: '✎', information: 'ℹ', 'information-circle': 'ⓘ', info: 'ⓘ', 'help-circle': '?', help: '?',
  time: '⏱', clock: '⏱', chatbubble: '💬', chatbubbles: '💬', message: '💬', mail: '✉', email: '✉', call: '☎', phone: '☎', cart: '🛒', 'shopping-cart': '🛒',
  book: '📖', school: '🎓', flash: '⚡', compass: '🧭', globe: '🌐', 'lock-closed': '🔒', lock: '🔒', 'log-out': '⇥', logout: '⇥', share: '⤴', 'share-social': '⤴',
  filter: '⚲', options: '☷', play: '▶', pause: '⏸', stop: '■', 'musical-notes': '♫', music: '♫', 'document-text': '📄', document: '📄', file: '📄',
  cloud: '☁', sunny: '☀', sun: '☀', moon: '☾', eye: '👁', 'eye-off': '⊘', refresh: '⟳', reload: '⟳', download: '⤓', upload: '⤒', send: '➤',
  wifi: '📶', battery: '🔋', flag: '⚑', gift: '🎁', fitness: '💪', restaurant: '🍴', cafe: '☕', car: '🚗', bus: '🚌', walk: '🚶', bicycle: '🚲',
  airplane: '✈', 'game-controller': '🎮', trophy: '🏆', ribbon: '🎗', medal: '🏅', pricetag: '🏷', tag: '🏷', wallet: '👛', card: '💳', 'credit-card': '💳',
  stats: '📊', 'bar-chart': '📊', analytics: '📈', 'trending-up': '📈', 'pie-chart': '◔', layers: '◫', code: '</>', 'code-slash': '</>', terminal: '⌨',
  'ellipsis-horizontal': '⋯', 'ellipsis-vertical': '⋮', 'dots-horizontal': '⋯', 'dots-vertical': '⋮', thumbs: '👍', 'thumbs-up': '👍', happy: '☺', sad: '☹',
};
function glyph(name: string) {
  const clean = String(name ?? '').replace(/^(ios|md|logo)-/, '').replace(/-(outline|sharp|o)$/, '');
  return GLYPHS[clean] ?? GLYPHS[clean.split('-')[0]] ?? '●';
}
function makeIconSet(family: string) {
  function Icon({ name, size = 24, color = '#1c1c1e', style, ...rest }: AnyProps) {
    return createElement(Text, {
      ...rest,
      accessibilityLabel: rest.accessibilityLabel ?? String(name),
      dataSet: { icon: `${family}:${name}` },
      style: [{ fontSize: size * 0.82, lineHeight: size, width: size, height: size, textAlign: 'center', color }, style],
    }, glyph(name));
  }
  Icon.displayName = family;
  return Object.assign(Icon, { glyphMap: {}, Button: Icon, getImageSource: async () => null, loadFont: async () => {} });
}
const ICON_FAMILIES = ['Ionicons', 'MaterialIcons', 'MaterialCommunityIcons', 'Feather', 'FontAwesome', 'FontAwesome5', 'FontAwesome6', 'AntDesign', 'Entypo', 'EvilIcons', 'Octicons', 'SimpleLineIcons', 'Foundation', 'Fontisto', 'Zocial'];
const vectorIcons = Object.fromEntries(ICON_FAMILIES.map((f) => [f, makeIconSet(f)]));

/* --------------------------------------------------------------- gradient */

function LinearGradient({ colors = [], start, end, locations, style, children, ...rest }: AnyProps) {
  const s = start ? (Array.isArray(start) ? { x: start[0], y: start[1] } : start) : { x: 0.5, y: 0 };
  const e = end ? (Array.isArray(end) ? { x: end[0], y: end[1] } : end) : { x: 0.5, y: 1 };
  const angle = (Math.atan2(e.y - s.y, e.x - s.x) * 180) / Math.PI + 90;
  const stops = (colors as string[]).map((c, i) => (locations?.[i] != null ? `${c} ${locations[i] * 100}%` : c)).join(', ');
  // react-native-web drops unknown style keys, so the gradient is a plain DOM layer behind the children
  return createElement(View, { ...rest, style: [{ overflow: 'hidden' }, style] },
    createElement('div', { 'aria-hidden': true, style: { position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${angle}deg, ${stops})`, pointerEvents: 'none' } }),
    children,
  );
}

/* --------------------------------------------------------- storage (Lab 06) */
// AsyncStorage, MMKV, SecureStore, NetInfo, SQLite and Supabase keep their data in the preview's "phone" (device.ts):
// it survives Restart app, and the Device storage panel shows it. See storage.ts, sqlite.ts, supabase.ts.

/* -------------------------------------------------------------- the rest */

const noop = () => {};
const resolved = async () => {};
const Constants = {
  expoConfig: { name: 'Lab preview', slug: 'lab-preview', version: '1.0.0', extra: { appEnv: PREVIEW_ENV.EXPO_PUBLIC_APP_ENV, apiUrl: PREVIEW_ENV.EXPO_PUBLIC_API_URL } },
  appOwnership: 'expo',
  executionEnvironment: 'storeClient',
  platform: { ios: {} },
  statusBarHeight: 44,
  sessionId: 'lab-preview',
};

const Passthrough = ({ children }: AnyProps) => children ?? null;
const ViewPassthrough = ({ children, style, ...rest }: AnyProps) => createElement(View, { ...rest, style: [{ flex: 1 }, style] }, children);

export function createPackages(rn: { SafeAreaView: unknown; insets: Record<string, number> }): Record<string, unknown> {
  const nav = Navigation;
  return {
    '@react-navigation/native': {
      NavigationContainer: nav.NavigationContainer, useNavigation: nav.useNavigation, useRoute: nav.useRoute, useIsFocused: nav.useIsFocused,
      useFocusEffect: nav.useFocusEffect, useTheme: nav.useTheme, DefaultTheme: nav.DefaultTheme, DarkTheme: nav.DarkTheme,
      createNavigationContainerRef: nav.createNavigationContainerRef, CommonActions: nav.CommonActions, StackActions: nav.StackActions,
      DrawerActions: nav.DrawerActions, TabActions: nav.TabActions, useScrollToTop: noop, useLinkTo: () => noop,
    },
    '@react-navigation/native-stack': { createNativeStackNavigator: nav.createNativeStackNavigator },
    '@react-navigation/stack': { createStackNavigator: nav.createStackNavigator, StackActions: nav.StackActions },
    '@react-navigation/bottom-tabs': { createBottomTabNavigator: nav.createBottomTabNavigator, useBottomTabBarHeight: () => 56 },
    '@react-navigation/drawer': { createDrawerNavigator: nav.createDrawerNavigator, DrawerActions: nav.DrawerActions, useDrawerStatus: () => 'closed' },
    '@react-navigation/elements': { useHeaderHeight: () => 52, HeaderBackButton: () => null },
    '@expo/vector-icons': vectorIcons,
    ...Object.fromEntries(ICON_FAMILIES.map((f) => [`@expo/vector-icons/${f}`, { default: vectorIcons[f] }])),
    'expo-linear-gradient': { LinearGradient },
    '@react-native-async-storage/async-storage': { default: AsyncStorage, ...AsyncStorage },
    'expo-constants': { default: Constants, ...Constants },
    'expo-haptics': {
      impactAsync: resolved, notificationAsync: resolved, selectionAsync: resolved,
      ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' }, NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    },
    'expo-font': { useFonts: () => [true, null], loadAsync: resolved, isLoaded: () => true },
    'expo-splash-screen': { preventAutoHideAsync: resolved, hideAsync: resolved, hide: noop, setOptions: noop },
    'expo-image': { Image },
    'react-native-svg': SvgModule,
    'expo-status-bar': { StatusBar: () => null, setStatusBarStyle: noop },
    'react-native-gesture-handler': { GestureHandlerRootView: ViewPassthrough, gestureHandlerRootHOC: (c: unknown) => c },
    'react-native-screens': { enableScreens: noop, enableFreeze: noop },
    'react-native-safe-area-context': {
      SafeAreaView: rn.SafeAreaView,
      SafeAreaProvider: Passthrough,
      useSafeAreaInsets: () => ({ ...rn.insets }),
      initialWindowMetrics: { insets: rn.insets, frame: { x: 0, y: 0, width: 390, height: 844 } },
    },
    // HTTP requests the Axios way (Lab 05), on top of fetch
    axios: { default: axios, ...axios },
    // storage (Lab 06): the same APIs as the real packages
    'react-native-mmkv': MMKVModule,
    'expo-secure-store': { ...SecureStore },
    '@react-native-community/netinfo': NetInfoModule,
    'expo-sqlite': { ...SQLite },
    'expo-sqlite/kv-store': { default: KvStore, ...KvStore },
    'expo-sqlite/localStorage/install': {},
    'expo-image-picker': { ...ImagePicker },
    'expo-crypto': { ...ExpoCrypto },
    'base64-arraybuffer': { decode, encode },
    'react-native-url-polyfill/auto': {},
    'react-native-url-polyfill': { setupURLPolyfill: noop },
    'react-native-get-random-values': {},
    'aes-js': aesjs,
    '@supabase/supabase-js': { createClient: createSupabaseClient },
    nativewind: { useColorScheme: () => ({ colorScheme: 'light', setColorScheme: noop, toggleColorScheme: noop }), cssInterop: noop, remapProps: noop },
  };
}

/** Names of every package students may import, for the "isn't available" message. */
export const PACKAGE_NAMES = [
  'react', 'react-native', 'expo-router', '@react-navigation/native', '@react-navigation/native-stack', '@react-navigation/bottom-tabs',
  '@react-navigation/drawer', '@expo/vector-icons', 'expo-linear-gradient', '@react-native-async-storage/async-storage', 'expo-constants',
  'expo-haptics', 'expo-image', 'react-native-safe-area-context', 'nativewind', 'axios',
  'react-native-mmkv', 'expo-secure-store', '@react-native-community/netinfo', 'expo-sqlite', 'expo-sqlite/kv-store',
  'expo-sqlite/localStorage/install', 'expo-image-picker', 'expo-crypto', 'base64-arraybuffer', 'react-native-url-polyfill/auto',
  'react-native-get-random-values', 'aes-js', '@supabase/supabase-js', 'react-native-svg', '@expo-google-fonts/…',
];

/**
 * @expo-google-fonts/<family>: useFonts says the fonts are loaded, and each font name (Inter_400Regular…) is its
 * own name, used as the fontFamily. The browser falls back to its own font when it does not have that one.
 */
export function googleFontsModule(): Record<string, unknown> {
  return new Proxy({ useFonts: () => [true, null], __esModule: true } as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : typeof key === 'string' ? key : undefined),
    has: () => true,
  });
}

