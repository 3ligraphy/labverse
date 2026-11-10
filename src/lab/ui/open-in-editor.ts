/**
 * "Open in Code Editor": copies a lab exercise (the student's current code and the task) into a new BUENOVA Code
 * project and opens it in a new tab. React Native exercises open next to the phone emulator. The copy is for
 * practice in the full editor; the exercise is still checked and saved on the lab page.
 */
import type { CodeExercise } from '../exercises/types.ts';

const plain = (md: string) => md.replace(/\*\*([^*]+)\*\*/g, '$1');

export async function openInEditor(ex: CodeExercise, files: Record<string, string>, labTitle: string) {
  // open the tab at once (inside the click), so the browser does not block it as a pop-up
  const win = window.open('about:blank', '_blank');
  try {
    const [{ WorkspaceFS }, { memo, workspaces }] = await Promise.all([import('../../ide/core/fs.ts'), import('../../ide/core/settings.ts')]);
    const ws = workspaces.create(`${labTitle} · ${ex.title}`, ex.frame === 'phone' ? 'react-native' : 'react');
    const fs = new WorkspaceFS(ws.id);
    for (const [path, code] of Object.entries(files)) await fs.write(`/${path}`, code);
    await fs.write('/README.md', `# ${ex.title}\n\n${plain(ex.prompt)}\n\n## Hints\n\n${ex.hints.map((h, i) => `${i + 1}. ${plain(h)}`).join('\n')}\n\n---\n\nThis is a copy of the exercise from ${labTitle}. Press ▶ Run (F5) to see it.\nTo get it checked and saved, paste your code back into the exercise on the lab page and press **Check** there.\n`);
    await fs.flush();
    memo.set(`tabs:${ws.id}`, [{ tabs: [`/${ex.entry}`, '/README.md'], active: `/${ex.entry}` }]);
    const url = `/ide?ws=${encodeURIComponent(ws.id)}`;
    if (win) win.location.href = url;
    else location.href = url;
  } catch (error) {
    win?.close();
    throw error;
  }
}
