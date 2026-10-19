/**
 * Space taken by the phone's status bar and home indicator in the current preview frame. Navigator headers and
 * tab bars pad themselves with it, as the real libraries do (0 in the browser frame and in the playground runner).
 */
export const safeArea = { top: 0, bottom: 0 };

export function setSafeArea(next: { top: number; bottom: number }) {
  safeArea.top = next.top;
  safeArea.bottom = next.bottom;
}
