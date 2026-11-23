/**
 * Admin → Marking → "Open in BUENOVA Code": the group's app code becomes a project of BUENOVA Code (/ide, the
 * VS Code-like editor of the Mobile Development module) in this browser, and opens in a new tab with its phone
 * emulator beside the code. The same hand-in version opens the project made before (instant), so a TA can go
 * back and forth between groups. Nothing is saved on the site: the project lives in this browser only.
 */
import { WorkspaceFS } from '@/ide/core/fs';
import { workspaces } from '@/ide/core/settings';
import type { AppSource } from '@/scripts/app-source';

const MAP_KEY = 'mk-ide:projects';
const readMap = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}'); } catch { return {}; } };
const writeMap = (m: Record<string, string>) => { try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch { /* private mode: no reuse */ } };

/**
 * The project for this app (made now, or the one made before for the same hand-in version). `onStep` reports
 * progress ("Copying 120 of 340 files"). Returns the /ide address that opens it.
 */
export async function ideProjectFor(key: string, name: string, src: AppSource, onStep?: (text: string) => void): Promise<string> {
  const map = readMap();
  const known = map[key] ? workspaces.get(map[key]) : null;
  if (known) {
    workspaces.touch(known.id);
    return `/ide?ws=${encodeURIComponent(known.id)}`;
  }
  const ws = workspaces.create(name, 'react-native');
  const fs = new WorkspaceFS(ws.id);
  try {
    let i = 0;
    const all = [...src.files];
    for (const [path, bytes] of all) {
      await fs.write(`/${path}`, bytes);
      if (++i % 40 === 0) onStep?.(`Copying ${i} of ${all.length} files…`);
    }
    await fs.flush();
  } catch (error) {
    workspaces.remove(ws.id);
    void WorkspaceFS.destroy(ws.id);
    throw error;
  }
  // keep the last 30 group projects linked; older ones stay in BUENOVA Code's project list
  writeMap(Object.fromEntries([...Object.entries(map), [key, ws.id]].slice(-30)));
  return `/ide?ws=${encodeURIComponent(ws.id)}`;
}
