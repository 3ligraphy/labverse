/** Lab 03 · Blocks 1–2 — the semester app brief and a UI system with NativeWind. Exercises 1–5. */
import type { CodeExercise, MatchExercise } from '../types.ts';
import { el, jsxElements } from '../helpers.ts';
import { LAB_ID } from './meta.ts';

const id = (name: string) => `${LAB_ID}--${name}`;
const fontSize = (s: Record<string, unknown>) => Number(s.fontSize) || 0;

export const ex01: MatchExercise = {
  id: id('brief-match'),
  n: 1,
  title: 'Read a product brief',
  minutes: 3,
  level: 1,
  kind: 'match',
  prompt: 'Drag each line of the **Campus Companion** brief onto the part of `docs/product-brief.md` it belongs to.',
  pairs: [
    { chip: 'Students miss campus events because announcements are scattered across chat groups.', target: 'Problem (one sentence)', why: 'A problem names who suffers and why — not the solution.' },
    { chip: 'First-year students, between lectures, on their phone', target: 'Primary user — and when they need the app', why: 'The moment of use drives the design: short sessions, one hand, poor signal.' },
    { chip: 'Discover events · save them · get a reminder', target: 'Three core features', why: 'Three is enough for a semester: each one becomes a vertical slice.' },
    { chip: 'Calendar reminders with local notifications', target: 'One device feature', why: 'Something only a phone does well — a later lab adds it.' },
    { chip: 'The university events API (JSON over HTTPS)', target: 'One external API', why: 'Real data arrives in the data/API labs.' },
    { chip: '6 of 10 testers save an event within 2 minutes', target: 'A measurable sign it is useful', why: 'You can check it with real users — “it looks nice” can’t be checked.' },
  ],
  decoys: [
    { chip: 'Built with React Native and NativeWind', why: 'That is the tech stack. A product brief describes the user’s problem, not the tools.' },
    { chip: 'Make it look modern', why: 'Not measurable, so nobody can tell when it is done.' },
  ],
  hints: [
    'Start with the problem: it is the only sentence that does not describe the app.',
    'Device feature = something only a phone does well. External API = data from someone else’s server.',
    'Two lines don’t belong in a brief at all — they say nothing about the user.',
  ],
  success: 'That is a brief a teammate can build from. Every later lab adds one taught technique to **this** app, so keep the problem stable all semester.',
};

export const ex02: CodeExercise = {
  id: id('exercise-project-card'),
  n: 2,
  title: 'Visualize the semester app idea',
  minutes: 6,
  level: 2,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Turn the plain brief into a product card with NativeWind: a dark screen, a rounded card, a big title, readable body text and a green pill-shaped action.',
  files: {
    'App.tsx': `import { View, Text } from 'react-native';

export default function App() {
  return (
    // 1. the screen: fill it, centre the card, dark background, padding
    <View>
      {/* 2. the card: rounded corners, a surface colour, padding and gap */}
      <View>
        {/* 3. a big, bold title */}
        <Text>Campus Companion</Text>
        <Text>Find events, places and activities around campus.</Text>
        {/* 4. a pill-shaped action: green background, rounded-full, padding */}
        <Text>Start exploring</Text>
      </View>
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'idea',
      label: 'keeps the product name and promise',
      fail: 'Keep the texts “Campus Companion” and “Start exploring”.',
      run: async (c) => /Campus Companion/.test(await c.app.text()) && /Start exploring/.test(await c.app.text()),
    },
    {
      id: 'screen',
      label: 'the screen fills the phone with a background colour',
      fail: 'Give the outer `View` `className="flex-1 justify-center bg-slate-950 p-6"`.',
      run: async (c) => (await c.app.find({ rn: 'View' })).some((v) => Number(v.style.flex) === 1 && !!v.style.backgroundColor),
    },
    {
      id: 'card',
      label: 'a rounded card surface',
      fail: 'Make the inner `View` a card: `rounded-3xl bg-slate-900 p-6` (any radius from `rounded-xl` up).',
      run: async (c) => (await c.app.find({ rn: 'View' })).some((v) => Number(v.style.borderRadius) >= 12 && !!v.style.backgroundColor && Number(v.style.flex) !== 1),
    },
    {
      id: 'title',
      label: 'a large title (text-2xl or bigger)',
      fail: 'Make the title stand out: `className="text-3xl font-bold text-white"`.',
      run: async (c) => {
        const [title] = await c.app.find({ rn: 'Text', text: 'Campus Companion' });
        if (!title) return 'I can’t see the title.';
        return fontSize(title.style) >= 24;
      },
    },
    {
      id: 'pill',
      label: 'the action is a coloured pill',
      fail: 'Style “Start exploring” as a pill: `rounded-full bg-emerald-300 px-4 py-2` (on the Text, or on a View around it).',
      run: async (c) => {
        const found = [...(await c.app.find({ rn: 'Text', text: /^Start exploring$/ })), ...(await c.app.find({ rn: 'View', text: /^Start exploring$/ }))];
        return found.some((f) => !!f.style.backgroundColor && Number(f.style.borderRadius) >= 12);
      },
    },
    {
      id: 'classes',
      label: 'styled with NativeWind `className`',
      fail: 'Use utility classes in `className="…"` rather than inline style objects for this one.',
      static: (c) => jsxElements(c.file()).filter((e) => e.attrs.className).length >= 3,
    },
  ],
  hints: [
    'Work outside-in: the screen `View`, then the card `View`, then each `Text`.',
    'Screen: `flex-1 justify-center bg-slate-950 p-6`. Card: `gap-4 rounded-3xl bg-slate-900 p-6`.',
    'Title: `text-3xl font-bold text-white`. Pill: `self-start rounded-full bg-emerald-300 px-4 py-2 font-bold`.',
  ],
  success: 'Hierarchy (big title), rhythm (`gap-4`), surface (the card) and a clear action: that is a design language, not decoration. Reuse it for every screen of your app.',
  challenge: 'Add a small uppercase label above the title: `text-xs font-bold uppercase tracking-widest text-emerald-300`.',
};

export const ex03: MatchExercise = {
  id: id('class-match'),
  n: 3,
  title: 'Classes with a purpose',
  minutes: 3,
  level: 2,
  kind: 'match',
  mono: true,
  prompt: 'A polished screen is a **system**. Drag each group of NativeWind classes onto the design job it does.',
  pairs: [
    { chip: 'text-3xl font-bold', target: 'Hierarchy: what the eye reads first', why: 'Size and weight set the reading order.' },
    { chip: 'gap-4', target: 'Rhythm: the same space between every item', why: 'One spacing step everywhere makes a screen feel calm.' },
    { chip: 'rounded-2xl bg-slate-900 p-5', target: 'Surface: groups related content into a card', why: 'A surface says “these things belong together”.' },
    { chip: 'active:opacity-70', target: 'Feedback: the control reacts while pressed', why: 'Touch needs visible feedback — there is no hover on a phone.' },
    { chip: 'disabled:opacity-40', target: 'State: shows an action is not available', why: 'Pair it with the `disabled` prop so it also cannot be pressed.' },
    { chip: 'ios:pt-12 android:pt-8', target: 'Platform: adapts to each phone’s system bars', why: 'Platform variants let one component respect both systems.' },
  ],
  decoys: [
    { chip: 'hover:bg-blue-500', why: 'Phones have no mouse, so hover never happens. Use `active:` for touch feedback.' },
    { chip: 'style="color: red"', why: 'That is HTML. In React Native use `className="text-red-500"` or `style={{ color: \'red\' }}`.' },
  ],
  hints: [
    'Feedback and State both change opacity — one happens while you press, the other when the action is off.',
    '`ios:` and `android:` are variants: the class only applies on that platform.',
    'Two chips are web habits that do nothing (or crash) on a phone.',
  ],
  success: 'Hierarchy, rhythm, surface, feedback, state, platform: six questions to ask of every screen you build this semester.',
};

export const ex04: CodeExercise = {
  id: id('exercise-ui'),
  n: 4,
  title: 'Accessible save card',
  minutes: 4,
  level: 3,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Make **Save** change to **Saved**, expose the control as an accessible button, and give it pressed feedback.',
  files: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

export default function App() {
  const [saved, setSaved] = useState(false);
  return (
    <View className="flex-1 justify-center bg-slate-950 p-6">
      <View className="gap-4 rounded-2xl bg-slate-900 p-5">
        <Text className="text-xl font-bold text-white">Architecture notes</Text>
        {/* 1. update saved  2. accessibilityRole="button"  3. pressed feedback */}
        <Pressable onPress={() => {}}>
          <Text className="text-emerald-300">{saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'start',
      label: 'starts as “Save”',
      fail: 'Before pressing, the button should read “Save”.',
      run: async (c) => {
        await c.app.rerun();
        return (await c.app.find({ rn: 'Text', text: /^Save$/ })).length > 0;
      },
    },
    {
      id: 'press',
      label: 'pressing it shows “Saved”',
      fail: 'In `onPress`, call `setSaved(true)`.',
      run: async (c) => {
        await c.app.rerun();
        await c.app.press({ text: /^Save$/ });
        return (await c.app.find({ rn: 'Text', text: /^Saved$/ })).length > 0;
      },
    },
    {
      id: 'role',
      label: 'it is announced as a button',
      fail: 'Screen readers need to know it is a button: add `accessibilityRole="button"` to the `Pressable`.',
      static: (c) => el(c.file(), 'Pressable').some((e) => e.attrs.accessibilityRole?.value === 'button' || e.attrs.role?.value === 'button'),
    },
    {
      id: 'feedback',
      label: 'it reacts while pressed',
      fail: 'Add pressed feedback, e.g. `className="… active:opacity-70"` on the `Pressable`.',
      static: (c) => el(c.file(), 'Pressable').some((e) => /active:/.test(e.attrs.className?.value ?? e.attrs.className?.code ?? '') || /pressed/.test(e.attrs.style?.code ?? '')),
    },
  ],
  hints: [
    'The state already exists: `saved` / `setSaved`. Call the setter inside `onPress`.',
    '`accessibilityRole="button"` goes on the `Pressable`, next to `onPress`.',
    'Make it look like a button too: `className="self-start rounded-xl bg-emerald-300 px-4 py-3 active:opacity-70"`.',
  ],
  success: 'A screen-reader user now hears “Save, button”, and everyone sees it react to a touch. Accessibility is part of the component, not a later fix.',
};

export const ex05: CodeExercise = {
  id: id('button-fix'),
  n: 5,
  title: 'Fix the AppButton primitive',
  minutes: 5,
  level: 4,
  kind: 'fix',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Shared `AppButton` has **3 bugs**: it crashes, a screen reader can’t tell it is a button, and its `disabled` prop does nothing. Fix the component, not the screen.',
  files: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

type Props = { label: string; onPress: () => void; disabled?: boolean };

// A shared UI primitive: it owns the look, the feedback and the accessibility.
function AppButton({ label, onPress, disabled = false }: Props) {
  return (
    <Pressable onPress={onPress} className="rounded-xl bg-emerald-300 px-5 py-3 active:opacity-70">
      {label}
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
}
`,
  },
  checks: [
    {
      id: 'text',
      label: 'the label is inside a `<Text>` (no crash)',
      fail: 'In React Native, words must be inside `<Text>`: render `<Text className="font-bold">{label}</Text>` inside the `Pressable`.',
      run: async (c) => (await c.app.find({ rn: 'Text', text: /^Book a seat$/ })).length > 0,
    },
    {
      id: 'works',
      label: '“Book a seat” still works',
      fail: 'Pressing “Book a seat” should add 1 to Booked.',
      run: async (c) => {
        await c.app.rerun();
        await c.app.press({ text: /^Book a seat$/ });
        return /Booked: 1/.test(await c.app.text());
      },
    },
    {
      id: 'disabled',
      label: 'a disabled button can’t be pressed',
      fail: 'Pass the prop on: `<Pressable disabled={disabled} …>`. Then pressing “Join waitlist” does nothing.',
      run: async (c) => {
        await c.app.rerun();
        await c.app.press({ text: /^Join waitlist$/ });
        return /Waitlist: 0/.test(await c.app.text());
      },
    },
    {
      id: 'looks-disabled',
      label: 'a disabled button looks disabled',
      fail: 'Show the state: add `disabled:opacity-40` to the classes (or `style={{ opacity: disabled ? 0.4 : 1 }}`).',
      run: async (c) => {
        const [btn] = await c.app.find({ rn: 'Pressable', text: /^Join waitlist$/ });
        return !!btn && Number(btn.style.opacity ?? 1) < 1;
      },
    },
    {
      id: 'role',
      label: 'announced as a button',
      fail: 'Add `accessibilityRole="button"` (and `accessibilityState={{ disabled }}`) to the `Pressable`.',
      static: (c) => el(c.file(), 'Pressable').some((e) => e.attrs.accessibilityRole?.value === 'button' || e.attrs.role?.value === 'button'),
    },
  ],
  hints: [
    'The red error tells you bug 1: text must be inside `<Text>`.',
    '`disabled` arrives as a prop but never reaches the `Pressable`. Pass it on: `disabled={disabled}`.',
    'Every shared button needs `accessibilityRole="button"`. Add `disabled:opacity-40` so people can see it is off.',
  ],
  success: 'Fixed once, fixed on every screen: that is why a shared `ui/` primitive owns its look, feedback, state and accessibility — and the feature only decides what `onPress` does.',
  challenge: 'Add a `variant?: \'primary\' | \'ghost\'` prop: the ghost button has a border and no background.',
};
