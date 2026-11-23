/**
 * Lab 07: expo-camera and expo-haptics in the lab previews. The browser has no phone camera and no vibration motor, so:
 * - CameraView draws a viewfinder ("Back camera" / "Front camera") with sample QR codes to "scan". A real camera reads
 *   the code in front of it many times a second, so one press sends the code three times in one burst: an app that
 *   does not lock after the first scan (a useRef) handles it three times (three haptic lines in the log).
 * - useCameraPermissions gives null first (the phone is still reading the permission), then the answer.
 *   requestPermission shows the phone's dialog (While using the app / Only this time / Don’t allow, as Android writes it). After two refusals
 *   the phone stops asking (canAskAgain false), like Android. The answer is kept until the device is erased.
 * - Each haptic call is written to the log ("Haptics: notification success") and shakes the screen a little.
 */
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native-web';
import { getScreenHost, registerStore } from './device.ts';

type AnyProps = Record<string, any>;
type Status = 'undetermined' | 'granted' | 'denied';
export type CameraPermission = { status: Status; granted: boolean; canAskAgain: boolean; expires: 'never' };

/* -------------------------------------------------------------- permission */

const camera = { status: 'undetermined' as Status, refusals: 0 };
const listeners = new Set<() => void>();
let dialog: { el: Element; answer: Promise<CameraPermission> } | null = null;

const permission = (): CameraPermission => ({
  status: camera.status,
  granted: camera.status === 'granted',
  canAskAgain: camera.refusals < 2,
  expires: 'never',
});

function notify() {
  for (const fn of listeners) fn();
}

registerStore({
  id: 'camera-permission',
  snapshot: () => [],
  reset: () => {
    camera.status = 'undetermined';
    camera.refusals = 0;
    dialog?.el.remove();
    dialog = null;
    notify();
  },
});

/** The phone's permission dialog, drawn over the app. Resolves with the answer. */
function askWithDialog(): Promise<CameraPermission> {
  if (dialog && dialog.el.isConnected) return dialog.answer;
  const host = getScreenHost();
  if (!host || typeof document === 'undefined') return Promise.resolve(permission());
  const el = document.createElement('div');
  el.className = 'lab-perm';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Camera permission');
  const card = document.createElement('div');
  card.className = 'lab-perm-card';
  card.innerHTML = '<div class="lab-perm-icon" aria-hidden="true">📷</div><p>Allow this app to take pictures and record video?</p>';
  el.appendChild(card);
  const answer = new Promise<CameraPermission>((resolve) => {
    const choose = (allow: boolean) => {
      el.remove();
      dialog = null;
      if (allow) camera.status = 'granted';
      else {
        camera.status = 'denied';
        camera.refusals += 1;
      }
      console.log(`Camera permission: ${allow ? 'allowed' : 'denied'}${!allow && camera.refusals >= 2 ? ' (the phone will not ask again)' : ''}`);
      notify();
      resolve(permission());
    };
    for (const [label, allow] of [['While using the app', true], ['Only this time', true], ['Don’t allow', false]] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => choose(allow));
      card.appendChild(button);
    }
  });
  host.appendChild(el);
  dialog = { el, answer };
  return answer;
}

export async function requestCameraPermissionsAsync(): Promise<CameraPermission> {
  // granted already, or the phone stopped asking: no dialog, just the answer
  if (camera.status === 'granted' || camera.refusals >= 2) return permission();
  return askWithDialog();
}
export const getCameraPermissionsAsync = async (): Promise<CameraPermission> => permission();

/**
 * Linking.openSettings(): this app's permission page in the phone's Settings. The only place the user can turn the
 * camera on again after the phone stopped asking. The app sees the new answer at once (on a phone: when it checks again).
 */
export function openAppSettings() {
  const host = getScreenHost();
  if (!host || typeof document === 'undefined') return;
  host.querySelector('.lab-settings')?.remove();
  const el = document.createElement('div');
  el.className = 'lab-perm lab-settings';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Settings: camera permission');
  const card = document.createElement('div');
  card.className = 'lab-perm-card';
  card.innerHTML = '<p class="lab-settings-path">Settings › Apps › this app › Permissions</p><p>Camera</p>';
  const now = camera.status === 'granted' ? 'allow' : camera.refusals >= 2 ? 'deny' : 'ask';
  const options = [
    ['allow', 'Allow only while using the app'],
    ['ask', 'Ask every time'],
    ['deny', 'Don’t allow'],
  ] as const;
  for (const [value, label] of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${value === now ? '●' : '○'} ${label}`;
    button.setAttribute('aria-pressed', String(value === now));
    button.addEventListener('click', () => {
      if (value === 'allow') camera.status = 'granted';
      else if (value === 'ask') Object.assign(camera, { status: 'undetermined', refusals: 0 });
      else Object.assign(camera, { status: 'denied', refusals: 2 });
      console.log(`Settings: camera ${value === 'allow' ? 'allowed' : value === 'ask' ? 'set to ask every time' : 'not allowed'}`);
      el.remove();
      notify();
    });
    card.appendChild(button);
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Back to the app';
  back.addEventListener('click', () => el.remove());
  card.appendChild(back);
  el.appendChild(card);
  host.appendChild(el);
}
const microphone = async (): Promise<CameraPermission> => ({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' });

export function useCameraPermissions(): [CameraPermission | null, () => Promise<CameraPermission>, () => Promise<CameraPermission>] {
  const [current, setCurrent] = useState<CameraPermission | null>(null);
  useEffect(() => {
    let alive = true;
    const update = () => {
      if (alive) setCurrent(permission());
    };
    // on a phone the first answer takes a moment, so the hook gives null first
    const first = setTimeout(update, 120);
    listeners.add(update);
    return () => {
      alive = false;
      clearTimeout(first);
      listeners.delete(update);
    };
  }, []);
  return [current, requestCameraPermissionsAsync, getCameraPermissionsAsync];
}

/* ------------------------------------------------------------------ camera */

/** The codes a student can "hold in front of the camera" in the preview. */
export const SAMPLE_CODES = [
  { label: 'Website', data: 'https://expo.dev' },
  { label: 'Wi-Fi', data: 'WIFI:S:Lab-5G;T:WPA;P:secret123;;' },
  { label: 'Text', data: 'Room 3.12' },
  { label: 'Empty code', data: '   ' },
];

export function CameraView(props: AnyProps): ReactNode {
  const { facing = 'back', style, children, testID } = props;
  const latest = useRef(props);
  latest.current = props;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (camera.status !== 'granted') {
      latest.current.onMountError?.({ message: 'Camera permission is not granted' });
      return () => {
        mounted.current = false;
      };
    }
    const ready = setTimeout(() => latest.current.onCameraReady?.(), 60);
    return () => {
      mounted.current = false;
      clearTimeout(ready);
    };
  }, []);

  /**
   * The camera reads the code three times in one burst, before React draws the screen again. So an app that only
   * "remembers" the scan in state (useState) handles it three times; a useRef lock handles it once.
   */
  function scan(data: string) {
    for (let read = 0; read < 3; read += 1) {
      const p = latest.current;
      if (!mounted.current) return;
      const types = p.barcodeScannerSettings?.barcodeTypes;
      const readsQr = !Array.isArray(types) || types.includes('qr');
      if (typeof p.onBarcodeScanned === 'function' && readsQr) {
        p.onBarcodeScanned({ type: 'qr', data, bounds: { origin: { x: 115, y: 300 }, size: { width: 160, height: 160 } }, cornerPoints: [] });
      }
    }
  }

  const on = camera.status === 'granted';
  return createElement(
    View,
    { style: [{ flex: 1, overflow: 'hidden', backgroundColor: '#0b0f17' }, style], testID, dataSet: { rn: 'CameraView' } },
    on && createElement(View, { style: { position: 'absolute', top: '22%', left: '18%', width: '64%', height: '40%', borderRadius: 24, backgroundColor: '#243047', opacity: 0.6 } }),
    createElement(
      View,
      { style: { position: 'absolute', top: 52, left: 10, right: 10, gap: 6, padding: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 5 } },
      createElement(Text, { style: { color: '#e2e8f0', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 } }, on ? `${facing === 'front' ? 'Front' : 'Back'} camera · tap a code to hold it in front of the camera` : 'Camera off: no permission'),
      on &&
        createElement(
          View,
          { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 } },
          ...SAMPLE_CODES.map((c) =>
            createElement(
              Pressable,
              { key: c.label, accessibilityRole: 'button', onPress: () => scan(c.data), style: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: '#f8fafc' } },
              createElement(Text, { style: { fontSize: 11, fontWeight: '700', color: '#0f172a' } }, `QR: ${c.label}`),
            ),
          ),
        ),
    ),
    children,
  );
}

export const Camera = {
  requestCameraPermissionsAsync,
  getCameraPermissionsAsync,
  requestMicrophonePermissionsAsync: microphone,
  getMicrophonePermissionsAsync: microphone,
};

export const CameraModule = {
  CameraView,
  Camera,
  useCameraPermissions,
  useMicrophonePermissions: () => [{ status: 'granted', granted: true, canAskAgain: true, expires: 'never' }, microphone, microphone],
  requestCameraPermissionsAsync,
  getCameraPermissionsAsync,
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
};

/* ------------------------------------------------------------------ haptics */

function buzz(kind: string): Promise<void> {
  console.log(`Haptics: ${kind}`);
  if (typeof document !== 'undefined') {
    const host = getScreenHost();
    if (host instanceof HTMLElement) {
      host.classList.remove('lab-buzz');
      void host.offsetWidth;
      host.classList.add('lab-buzz');
      setTimeout(() => host.classList.remove('lab-buzz'), 360);
    }
  }
  return Promise.resolve();
}

export const HapticsModule = {
  impactAsync: (style: string = 'medium') => buzz(`impact ${style}`),
  notificationAsync: (type: string = 'success') => buzz(`notification ${type}`),
  selectionAsync: () => buzz('selection'),
  performAndroidHapticsAsync: (type: string) => buzz(`android ${type}`),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: {
    Clock_Tick: 'clock-tick', Confirm: 'confirm', Context_Click: 'context-click', Drag_Start: 'drag-start', Gesture_End: 'gesture-end',
    Gesture_Start: 'gesture-start', Keyboard_Press: 'keyboard-press', Keyboard_Release: 'keyboard-release', Keyboard_Tap: 'keyboard-tap',
    Long_Press: 'long-press', No_Haptics: 'no-haptics', Reject: 'reject', Segment_Frequent_Tick: 'segment-frequent-tick', Segment_Tick: 'segment-tick',
    Text_Handle_Move: 'text-handle-move', Toggle_Off: 'toggle-off', Toggle_On: 'toggle-on', Virtual_Key: 'virtual-key', Virtual_Key_Release: 'virtual-key-release',
  },
};
