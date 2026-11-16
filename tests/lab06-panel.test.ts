// Lab 06's Device storage panel: the "Add a task from your tablet" button appears only for apps that use Realtime,
// and sends one change from the student's other device each time it is pressed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost/', width: 1200, height: 800 });
const { DevicePanel, REALTIME_USE } = await import('../src/lab/ui/device-panel.ts');

const noop = () => {};
const button = (root: HTMLElement, label: RegExp) => [...root.querySelectorAll('button')].find((b) => label.test(b.textContent ?? ''));

test('the tablet button is there only when the app uses Realtime, and each press sends one task', async () => {
  const plain = new DevicePanel({ restart: noop, erase: noop });
  assert.equal(button(plain.root, /tablet/i), undefined, 'no Realtime: no tablet button');

  const sent: string[] = [];
  const live = new DevicePanel({ restart: noop, erase: noop, remote: (title) => void sent.push(title) });
  const b = button(live.root, /Add a task from your tablet/);
  assert.ok(b, 'the button is shown');
  b!.click();
  b!.click();
  assert.equal(sent.length, 2);
  assert.notEqual(sent[0], sent[1], 'each task has its own title');
  assert.match(sent[0], /tablet/i);
});

test('REALTIME_USE spots channel code', () => {
  assert.ok(REALTIME_USE.test("supabase.channel('tasks').on('postgres_changes', {}, cb)"));
  assert.ok(!REALTIME_USE.test("supabase.from('tasks').select('*')"));
});
