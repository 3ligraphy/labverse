/**
 * React Navigation for the lab previews: enough of @react-navigation/native, native-stack, stack, bottom-tabs
 * and drawer to run the navigation code students write in the labs, in the browser.
 *
 * Supported: NavigationContainer (with a theme), Stack / Tabs / Drawer navigators and their nesting,
 * route params and initialParams, navigate / push / goBack / replace / popToTop / setParams / setOptions,
 * navigate('Main', { screen: 'Profile', params }) into a nested navigator, openDrawer / jumpTo,
 * useNavigation, useRoute, useIsFocused, useFocusEffect, headers with a back button, a tab bar with
 * tabBarIcon, and a drawer menu. Screens stay mounted when you leave them, as in the real library.
 */
import React, {
  Children, createContext, Fragment, isValidElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ComponentType, type ReactElement, type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native-web';

type Params = Record<string, unknown> | undefined;
export type Route = { key: string; name: string; params?: Params };
type Kind = 'stack' | 'tabs' | 'drawer';
type AnyFn = (...args: any[]) => any;
type Options = {
  title?: string;
  headerShown?: boolean;
  headerTitle?: string | AnyFn;
  headerStyle?: object;
  headerTintColor?: string;
  headerTitleStyle?: object;
  headerRight?: AnyFn;
  headerLeft?: AnyFn;
  headerBackTitle?: string;
  tabBarIcon?: AnyFn;
  tabBarLabel?: string;
  tabBarBadge?: string | number;
  tabBarActiveTintColor?: string;
  tabBarInactiveTintColor?: string;
  tabBarStyle?: object;
  drawerLabel?: string;
  drawerActiveTintColor?: string;
  contentStyle?: object;
  [key: string]: unknown;
};
type OptionsInput = Options | ((p: { route: Route; navigation: Navigation }) => Options);
type ScreenProps = {
  name: string;
  component?: ComponentType<any>;
  getComponent?: () => ComponentType<any>;
  children?: (props: { navigation: Navigation; route: Route }) => ReactNode;
  options?: OptionsInput;
  initialParams?: Params;
};

export type Navigation = {
  navigate(name: string | { name: string; params?: Params }, params?: Params): void;
  push(name: string, params?: Params): void;
  goBack(): void;
  pop(count?: number): void;
  popToTop(): void;
  replace(name: string, params?: Params): void;
  reset(state: { index?: number; routes: { name: string; params?: Params }[] }): void;
  setParams(params: Params): void;
  setOptions(options: Options): void;
  canGoBack(): boolean;
  isFocused(): boolean;
  getParent(): Navigation | undefined;
  getState(): { index: number; routes: Route[]; type: Kind };
  dispatch(action: { type: string; payload?: any }): void;
  jumpTo(name: string, params?: Params): void;
  openDrawer(): void;
  closeDrawer(): void;
  toggleDrawer(): void;
  addListener(event: string, cb: AnyFn): () => void;
  removeListener(event: string, cb: AnyFn): void;
};

type Theme = { dark: boolean; colors: { primary: string; background: string; card: string; text: string; border: string; notification: string } };
export const DefaultTheme: Theme = { dark: false, colors: { primary: '#007AFF', background: '#f2f2f2', card: '#ffffff', text: '#1c1c1e', border: '#d8d8d8', notification: '#ff3b30' } };
export const DarkTheme: Theme = { dark: true, colors: { primary: '#0A84FF', background: '#010101', card: '#121212', text: '#e5e5e7', border: '#272729', notification: '#ff453a' } };

const ThemeCtx = createContext<Theme>(DefaultTheme);
const ContainerCtx = createContext(false);
/** The screen a component is rendered in (what useNavigation / useRoute return). */
const ScreenCtx = createContext<{ navigation: Navigation; route: Route; focused: boolean } | null>(null);

let keySeq = 0;
const newKey = (name: string) => `${name}-${++keySeq}`;

function missingContainer(): never {
  throw new Error("Couldn't find a navigation container. Wrap your navigators in <NavigationContainer>…</NavigationContainer>.");
}

export function NavigationContainer({ children, theme }: { children?: ReactNode; theme?: Theme; [key: string]: unknown }) {
  return (
    <ContainerCtx.Provider value>
      <ThemeCtx.Provider value={theme ?? DefaultTheme}>
        <View style={[s.fill, { backgroundColor: (theme ?? DefaultTheme).colors.background }]}>{children}</View>
      </ThemeCtx.Provider>
    </ContainerCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
export function useNavigation<T = Navigation>(): T {
  const c = useContext(ScreenCtx);
  if (!c) throw new Error("useNavigation() only works inside a screen. Call it in a component that a navigator renders, or use the navigation prop.");
  return c.navigation as T;
}
export function useRoute<T = Route>(): T {
  const c = useContext(ScreenCtx);
  if (!c) throw new Error('useRoute() only works inside a screen rendered by a navigator.');
  return c.route as T;
}
export function useIsFocused() {
  return useContext(ScreenCtx)?.focused ?? true;
}
/** Runs the callback when the screen gains focus (and its cleanup when it loses focus). */
export function useFocusEffect(effect: () => void | (() => void)) {
  const focused = useIsFocused();
  useEffect(() => (focused ? effect() : undefined), [focused, effect]);
}
export function createNavigationContainerRef() {
  return { current: null, isReady: () => false, navigate: () => {}, goBack: () => {} };
}
export const CommonActions = {
  navigate: (name: string | { name: string; params?: Params }, params?: Params) => ({ type: 'NAVIGATE', payload: typeof name === 'string' ? { name, params } : name }),
  goBack: () => ({ type: 'GO_BACK' }),
  reset: (state: { index?: number; routes: { name: string; params?: Params }[] }) => ({ type: 'RESET', payload: state }),
  setParams: (params: Params) => ({ type: 'SET_PARAMS', payload: { params } }),
};
export const StackActions = {
  push: (name: string, params?: Params) => ({ type: 'PUSH', payload: { name, params } }),
  pop: (count = 1) => ({ type: 'POP', payload: { count } }),
  popToTop: () => ({ type: 'POP_TO_TOP' }),
  replace: (name: string, params?: Params) => ({ type: 'REPLACE', payload: { name, params } }),
};
export const DrawerActions = { openDrawer: () => ({ type: 'OPEN_DRAWER' }), closeDrawer: () => ({ type: 'CLOSE_DRAWER' }), toggleDrawer: () => ({ type: 'TOGGLE_DRAWER' }), jumpTo: (name: string, params?: Params) => ({ type: 'JUMP_TO', payload: { name, params } }) };
export const TabActions = { jumpTo: (name: string, params?: Params) => ({ type: 'JUMP_TO', payload: { name, params } }) };

/** <Screen>s inside a navigator, including those inside <Group> and fragments. */
function collectScreens(children: ReactNode, inherited: OptionsInput | undefined = undefined, out: (ScreenProps & { group?: OptionsInput })[] = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<any>;
    if ((el.type as { __navScreen?: boolean }).__navScreen) out.push({ ...(el.props as ScreenProps), group: inherited });
    else if ((el.type as { __navGroup?: boolean }).__navGroup || el.type === Fragment) collectScreens(el.props.children, el.props.screenOptions ?? inherited, out);
  });
  return out;
}

function resolveOptions(input: OptionsInput | undefined, route: Route, navigation: Navigation): Options {
  if (!input) return {};
  return typeof input === 'function' ? input({ route, navigation }) ?? {} : input;
}

type NavState = { routes: Route[]; index: number; history: number[]; drawerOpen: boolean };

function createNavigator(kind: Kind) {
  function Screen(_: ScreenProps) {
    return null;
  }
  (Screen as unknown as { __navScreen: boolean }).__navScreen = true;
  function Group(_: { children?: ReactNode; screenOptions?: OptionsInput }) {
    return null;
  }
  (Group as unknown as { __navGroup: boolean }).__navGroup = true;

  function Navigator({ children, initialRouteName, screenOptions, backBehavior }: { children?: ReactNode; initialRouteName?: string; screenOptions?: OptionsInput; backBehavior?: string; [key: string]: unknown }) {
    if (!useContext(ContainerCtx)) missingContainer();
    const theme = useTheme();
    const parent = useContext(ScreenCtx);
    const screens = collectScreens(children);
    if (!screens.length) throw new Error(`A ${kind} navigator needs at least one <Screen name="…" component={…} />.`);
    const byName = new Map(screens.map((sc) => [sc.name, sc]));
    const names = screens.map((sc) => sc.name);
    // navigate('Parent', { screen: 'Child', params }) from outside: start on that child
    const nested = parent?.route.params as { screen?: string; params?: Params } | undefined;
    const first = nested?.screen && byName.has(nested.screen) ? nested.screen : initialRouteName && byName.has(initialRouteName) ? initialRouteName : names[0];
    const make = (name: string, params?: Params): Route => ({ key: newKey(name), name, params: { ...(byName.get(name)?.initialParams ?? {}), ...(params ?? {}) } });

    const [state, setState] = useState<NavState>(() => {
      if (kind === 'stack') return { routes: [make(first, nested?.screen === first ? nested.params : undefined)], index: 0, history: [0], drawerOpen: false };
      const routes = names.map((n) => make(n, nested?.screen === n ? nested.params : undefined));
      const index = names.indexOf(first);
      return { routes, index, history: [index], drawerOpen: false };
    });
    const [overrides, setOverrides] = useState<Record<string, Options>>({});
    const stateRef = useRef(state);
    stateRef.current = state;

    // a later navigate('Parent', { screen: 'Child' }) while this navigator is already on screen
    const nestedKey = nested?.screen ? JSON.stringify(nested) : '';
    useEffect(() => {
      if (nested?.screen && byName.has(nested.screen)) go(nested.screen, nested.params, false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nestedKey]);

    const go = useCallback((name: string, params: Params, forcePush: boolean) => {
      setState((st) => {
        if (kind === 'stack') {
          const at = forcePush ? -1 : st.routes.findIndex((r) => r.name === name);
          if (at >= 0) {
            const routes = st.routes.slice(0, at + 1);
            if (params) routes[at] = { ...routes[at], params: { ...routes[at].params, ...params } };
            return { ...st, routes, index: at };
          }
          const routes = [...st.routes, make(name, params)];
          return { ...st, routes, index: routes.length - 1 };
        }
        const i = st.routes.findIndex((r) => r.name === name);
        const routes = params ? st.routes.map((r, j) => (j === i ? { ...r, params: { ...r.params, ...params } } : r)) : st.routes;
        return { ...st, routes, index: i, history: [...st.history.filter((h) => h !== i), i], drawerOpen: false };
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const navFor = (route: Route): Navigation => {
      const self: Navigation = {
        navigate(target, params) {
          const { name, params: p } = typeof target === 'string' ? { name: target, params } : target;
          if (byName.has(name)) go(name, p, false);
          else if (parent) parent.navigation.navigate(name, p);
          else console.error(`The action 'NAVIGATE' with payload {"name":"${name}"} was not handled by any navigator. Do you have a screen named '${name}'?`);
        },
        push(name, params) {
          if (kind !== 'stack') return self.navigate(name, params);
          if (!byName.has(name)) return parent?.navigation.navigate(name, params);
          go(name, params, true);
        },
        goBack() {
          const st = stateRef.current;
          if (kind === 'stack' && st.routes.length > 1) setState({ ...st, routes: st.routes.slice(0, -1), index: st.routes.length - 2 });
          else if (kind !== 'stack' && backBehavior !== 'none' && st.history.length > 1) {
            const history = st.history.slice(0, -1);
            setState({ ...st, history, index: history[history.length - 1] });
          } else if (parent) parent.navigation.goBack();
        },
        pop(count = 1) {
          const st = stateRef.current;
          if (kind !== 'stack') return self.goBack();
          const keep = Math.max(1, st.routes.length - count);
          setState({ ...st, routes: st.routes.slice(0, keep), index: keep - 1 });
        },
        popToTop() {
          const st = stateRef.current;
          if (kind === 'stack') setState({ ...st, routes: st.routes.slice(0, 1), index: 0 });
        },
        replace(name, params) {
          const st = stateRef.current;
          if (kind !== 'stack' || !byName.has(name)) return self.navigate(name, params);
          const routes = [...st.routes.slice(0, -1), make(name, params)];
          setState({ ...st, routes, index: routes.length - 1 });
        },
        reset({ index, routes }) {
          const list = routes.filter((r) => byName.has(r.name));
          if (!list.length) return;
          if (kind === 'stack') {
            const rs = list.map((r) => make(r.name, r.params));
            const i = Math.min(index ?? rs.length - 1, rs.length - 1);
            setState({ routes: rs.slice(0, i + 1), index: i, history: [i], drawerOpen: false });
          } else go(list[Math.min(index ?? 0, list.length - 1)].name, list[Math.min(index ?? 0, list.length - 1)].params, false);
        },
        setParams(params) {
          setState((st) => ({ ...st, routes: st.routes.map((r) => (r.key === route.key ? { ...r, params: { ...r.params, ...params } } : r)) }));
        },
        setOptions(options) {
          setOverrides((o) => ({ ...o, [route.key]: { ...o[route.key], ...options } }));
        },
        canGoBack() {
          const st = stateRef.current;
          return (kind === 'stack' ? st.routes.length > 1 : st.history.length > 1) || Boolean(parent?.navigation.canGoBack());
        },
        isFocused() {
          const st = stateRef.current;
          return st.routes[st.index]?.key === route.key && (parent ? parent.navigation.isFocused() : true);
        },
        getParent: () => parent?.navigation,
        getState: () => ({ index: stateRef.current.index, routes: stateRef.current.routes, type: kind }),
        dispatch(action) {
          const p = action.payload ?? {};
          switch (action.type) {
            case 'NAVIGATE': return self.navigate(p.name, p.params);
            case 'PUSH': return self.push(p.name, p.params);
            case 'POP': return self.pop(p.count);
            case 'POP_TO_TOP': return self.popToTop();
            case 'REPLACE': return self.replace(p.name, p.params);
            case 'GO_BACK': return self.goBack();
            case 'RESET': return self.reset(p);
            case 'SET_PARAMS': return self.setParams(p.params);
            case 'JUMP_TO': return self.jumpTo(p.name, p.params);
            case 'OPEN_DRAWER': return self.openDrawer();
            case 'CLOSE_DRAWER': return self.closeDrawer();
            case 'TOGGLE_DRAWER': return self.toggleDrawer();
          }
        },
        jumpTo(name, params) {
          self.navigate(name, params);
        },
        openDrawer() {
          if (kind === 'drawer') setState((st) => ({ ...st, drawerOpen: true }));
          else parent?.navigation.openDrawer();
        },
        closeDrawer() {
          if (kind === 'drawer') setState((st) => ({ ...st, drawerOpen: false }));
          else parent?.navigation.closeDrawer();
        },
        toggleDrawer() {
          if (kind === 'drawer') setState((st) => ({ ...st, drawerOpen: !st.drawerOpen }));
          else parent?.navigation.toggleDrawer();
        },
        addListener: () => () => {},
        removeListener: () => {},
      };
      return self;
    };

    const navs = useMemo(() => new Map<string, Navigation>(), []);
    const navOf = (route: Route) => {
      let n = navs.get(route.key);
      if (!n) navs.set(route.key, (n = navFor(route)));
      return n;
    };
    const optionsOf = (route: Route): Options => {
      const sc = byName.get(route.name);
      const nav = navOf(route);
      return { ...resolveOptions(screenOptions, route, nav), ...resolveOptions(sc?.group, route, nav), ...resolveOptions(sc?.options, route, nav), ...overrides[route.key] };
    };

    const focusedRoute = state.routes[state.index];
    const focusedOptions = optionsOf(focusedRoute);
    const parentFocused = parent ? parent.focused : true;

    // stacks keep every pushed screen; tabs/drawers keep screens that were visited
    const [visited, setVisited] = useState<Set<string>>(() => new Set([focusedRoute.key]));
    useLayoutEffect(() => {
      if (!visited.has(focusedRoute.key)) setVisited(new Set([...visited, focusedRoute.key]));
    }, [focusedRoute.key, visited]);
    const mounted = kind === 'stack' ? state.routes : state.routes.filter((r) => r.key === focusedRoute.key || visited.has(r.key));

    const body = (
      <View style={s.fill}>
        {mounted.map((route) => {
          const sc = byName.get(route.name)!;
          const navigation = navOf(route);
          const focused = route.key === focusedRoute.key;
          const Comp = sc.component ?? sc.getComponent?.();
          const opts = optionsOf(route);
          const content = Comp ? <Comp navigation={navigation} route={route} /> : sc.children ? sc.children({ navigation, route }) : null;
          return (
            <View key={route.key} style={[s.fill, { backgroundColor: theme.colors.background }, opts.contentStyle, !focused && s.hidden]} aria-hidden={!focused}>
              <ScreenCtx.Provider value={{ navigation, route, focused: focused && parentFocused }}>{content}</ScreenCtx.Provider>
            </View>
          );
        })}
      </View>
    );

    const nav = navOf(focusedRoute);
    const header = focusedOptions.headerShown === false ? null : (
      <Header
        options={focusedOptions}
        title={typeof focusedOptions.headerTitle === 'string' ? focusedOptions.headerTitle : focusedOptions.title ?? focusedRoute.name}
        back={kind === 'stack' && state.index > 0 ? () => nav.goBack() : undefined}
        menu={kind === 'drawer' ? () => nav.toggleDrawer() : undefined}
        navigation={nav}
        theme={theme}
      />
    );

    if (kind === 'tabs') {
      const on = focusedOptions.tabBarActiveTintColor ?? theme.colors.primary;
      const off = focusedOptions.tabBarInactiveTintColor ?? '#8e8e93';
      return (
        <View style={s.fill}>
          {header}
          {body}
          <View style={[s.tabbar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }, focusedOptions.tabBarStyle]} accessibilityRole="tablist">
            {state.routes.map((route, i) => {
              const o = optionsOf(route);
              const focused = i === state.index;
              const color = focused ? on : off;
              const label = o.tabBarLabel ?? o.title ?? route.name;
              return (
                <Pressable key={route.key} style={s.tab} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }} onPress={() => navOf(route).navigate(route.name)}>
                  <View>
                    {o.tabBarIcon ? o.tabBarIcon({ focused, color, size: 22 }) : <View style={[s.dot, { backgroundColor: color }]} />}
                    {o.tabBarBadge != null && <Text style={s.badge}>{String(o.tabBarBadge)}</Text>}
                  </View>
                  <Text style={[s.tabLabel, { color }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (kind === 'drawer') {
      return (
        <View style={s.fill}>
          {header}
          {body}
          {state.drawerOpen && (
            <View style={s.drawerWrap}>
              <Pressable style={s.scrim} accessibilityLabel="Close menu" onPress={() => nav.closeDrawer()} />
              <View style={[s.drawer, { backgroundColor: theme.colors.card }]} accessibilityRole="menu">
                {state.routes.map((route, i) => {
                  const o = optionsOf(route);
                  const focused = i === state.index;
                  const tint = o.drawerActiveTintColor ?? theme.colors.primary;
                  return (
                    <Pressable key={route.key} accessibilityRole="menuitem" style={[s.drawerItem, focused && { backgroundColor: `${tint}22` }]} onPress={() => navOf(route).navigate(route.name)}>
                      <Text style={[s.drawerLabel, { color: focused ? tint : theme.colors.text }]}>{o.drawerLabel ?? o.title ?? route.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={s.fill}>
        {header}
        {body}
      </View>
    );
  }

  return () => ({ Navigator, Screen, Group });
}

function Header({ options, title, back, menu, navigation, theme }: { options: Options; title: string; back?: () => void; menu?: () => void; navigation: Navigation; theme: Theme }) {
  const tint = options.headerTintColor ?? theme.colors.primary;
  const titleColor = options.headerTintColor ?? theme.colors.text;
  const left = options.headerLeft?.({ tintColor: tint, canGoBack: Boolean(back) });
  return (
    <View style={[s.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }, options.headerStyle]}>
      <View style={s.side}>
        {left ?? (back ? (
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Go back" style={s.backBtn}>
            <Text style={[s.backText, { color: tint }]}>‹ {options.headerBackTitle ?? 'Back'}</Text>
          </Pressable>
        ) : menu ? (
          <Pressable onPress={menu} accessibilityRole="button" accessibilityLabel="Open menu" style={s.backBtn}>
            <Text style={[s.menuIcon, { color: titleColor }]}>☰</Text>
          </Pressable>
        ) : null)}
      </View>
      <Text style={[s.title, { color: titleColor }, options.headerTitleStyle]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={[s.side, s.right]}>{options.headerRight?.({ tintColor: tint, navigation })}</View>
    </View>
  );
}

export const createNativeStackNavigator = createNavigator('stack');
export const createStackNavigator = createNativeStackNavigator;
export const createBottomTabNavigator = createNavigator('tabs');
export const createDrawerNavigator = createNavigator('drawer');
/** createStaticNavigation (React Navigation 7's static API) is not simulated: point students to the dynamic API. */

const s = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 8 },
  side: { width: 76, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backText: { fontSize: 16 },
  menuIcon: { fontSize: 22 },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 6, paddingBottom: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, marginVertical: 7 },
  badge: { position: 'absolute', top: -4, right: -12, minWidth: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#ff3b30', color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center', overflow: 'hidden' },
  drawerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  drawer: { width: '72%', height: '100%', paddingTop: 56, paddingHorizontal: 12, gap: 4, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16 },
  drawerItem: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  drawerLabel: { fontSize: 15, fontWeight: '600' },
});
