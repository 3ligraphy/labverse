/** Lab 07 live examples — editable, not graded. Each one shows one idea before its exercises. */
import type { Demo } from '../types.ts';
import { projectFiles } from './project.ts';

export const demos: Record<string, Demo> = {
  'smart-qr-app': {
    id: 'smart-qr-app',
    title: 'The finished Smart QR Scanner',
    frame: 'phone',
    entry: 'App.tsx',
    files: projectFiles(),
    tryThis: [
      'Press **Start scanning**, then **Allow camera** and **While using the app**: the phone’s own permission dialog.',
      'Press **QR: Website**: the result card opens and the **Console** shows `Haptics: notification success` (on a phone you feel it).',
      'Press **Scan again**, then **QR: Wi-Fi**. Look closely at the card: the password is on the screen. You fix that in the final challenge.',
    ],
  },

  'camera-permission': {
    id: 'camera-permission',
    title: 'The camera permission, step by step',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { Linking, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  // [the answer (null at first), the function that shows the phone's dialog]
  const [permission, requestPermission] = useCameraPermissions();

  return (
    <View style={{ flex: 1, gap: 12, padding: 20, paddingTop: 56, backgroundColor: '#0F172A' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>The camera permission</Text>

      {/* what the hook gives right now */}
      <Text style={{ color: '#7DD3FC', fontSize: 15, fontFamily: 'monospace' }}>
        {permission === null
          ? 'permission = null (still asking the phone)'
          : \`status: \${permission.status}\\ngranted: \${permission.granted}\\ncanAskAgain: \${permission.canAskAgain}\`}
      </Text>

      <Pressable onPress={requestPermission} style={{ padding: 14, borderRadius: 12, backgroundColor: '#0EA5E9' }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}>requestPermission()</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openSettings()} style={{ padding: 14, borderRadius: 12, backgroundColor: '#334155' }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}>Linking.openSettings()</Text>
      </Pressable>

      {/* the camera only when the user said yes */}
      {permission?.granted && (
        <CameraView style={{ height: 230, borderRadius: 16 }} onBarcodeScanned={(scan) => console.log('Read:', scan.data)} />
      )}
    </View>
  );
}
`,
    },
    tryThis: [
      'Watch the first line: `null` for a moment, then `status: undetermined`.',
      'Press **requestPermission()** and **Don’t allow** twice: `canAskAgain` becomes `false`, and the dialog never comes back.',
      'Now press **Linking.openSettings()** and allow the camera there. Then press **QR: Text** once: the **Console** shows several `Read:` lines for one code.',
    ],
  },

  'haptics-buttons': {
    id: 'haptics-buttons',
    title: 'Every kind of haptic, one button each',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

// each button plays one pattern; on a phone you feel the difference
const PATTERNS = [
  { name: 'Success', when: 'the job worked', play: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
  { name: 'Warning', when: 'look before going on', play: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) },
  { name: 'Error', when: 'it did not work', play: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) },
  { name: 'Selection', when: 'a choice changed', play: () => Haptics.selectionAsync() },
  { name: 'Impact: Light', when: 'a small touch', play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) },
  { name: 'Impact: Heavy', when: 'a big object lands', play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy) },
];

export default function App() {
  return (
    <View style={{ flex: 1, gap: 10, padding: 20, paddingTop: 56, backgroundColor: '#0F172A' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 6 }}>Haptics</Text>
      {PATTERNS.map((p) => (
        <Pressable key={p.name} onPress={p.play} style={{ padding: 14, borderRadius: 12, backgroundColor: '#1E293B' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{p.name}</Text>
          <Text style={{ color: '#94A3B8', fontSize: 13 }}>{p.when}</Text>
        </Pressable>
      ))}
    </View>
  );
}
`,
    },
    tryThis: [
      'Press each button: the preview phone shakes, and the **Console** names the pattern that played.',
      'A browser cannot vibrate. In Part 4 you feel the real ones: Smart QR plays Success and Error on your phone in Expo Go.',
      'Change `Light` to `Medium` and press it again.',
    ],
  },

  'scan-lock': {
    id: 'scan-lock',
    title: 'Why the scanner needs a lock',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [lockOn, setLockOn] = useState(true);
  const [calls, setCalls] = useState(0);
  const locked = useRef(false); // changes at once, without drawing the screen again

  function handleScan(data: string) {
    if (lockOn) {
      if (locked.current) return; // a code was already handled: stop
      locked.current = true;
    }
    console.log('handleScan:', data);
    setCalls((n) => n + 1);
  }

  function reset() {
    locked.current = false;
    setCalls(0);
  }

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0F172A' }}>
        <Pressable onPress={requestPermission} style={{ padding: 14, borderRadius: 12, backgroundColor: '#0EA5E9' }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(scan) => handleScan(scan.data)} />
      <View style={{ gap: 8, padding: 16, backgroundColor: '#0F172A' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>handleScan ran {calls} times</Text>
        <Pressable onPress={() => { setLockOn(!lockOn); reset(); }} style={{ padding: 12, borderRadius: 12, backgroundColor: lockOn ? '#16A34A' : '#DC2626' }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}>Lock: {lockOn ? 'on' : 'off'} (tap to switch)</Text>
        </Pressable>
        <Pressable onPress={reset} style={{ padding: 12, borderRadius: 12, backgroundColor: '#334155' }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}>Open the lock again</Text>
        </Pressable>
      </View>
    </View>
  );
}
`,
    },
    tryThis: [
      'Allow the camera, then press **QR: Website** once with the lock on: `handleScan ran 1 times`. Press it again: still 1.',
      'Switch the lock **off** and press **QR: Website** once: 3 — one per read.',
      'Change `useRef(false)` to `useState(false)` (and `locked.current` to the state): the lock comes too late. Why?',
    ],
  },
};
