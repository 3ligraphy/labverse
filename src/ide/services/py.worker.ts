/**
 * Python in the browser: CPython compiled to WebAssembly (Pyodide), in a worker so the page never freezes.
 * input() blocks the worker on a SharedArrayBuffer until the page sends the typed line.
 * Messages in:  { type: 'run', path, files: {path: bytes}, shared: SharedArrayBuffer }
 * Messages out: { type: 'status'|'out'|'err'|'input'|'done', ... }
 */
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
const post = (m: Record<string, unknown>, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);
const dec = new TextDecoder();
const enc = new TextEncoder();

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as { type: string; path: string; files: Record<string, Uint8Array>; shared: SharedArrayBuffer; debug?: { shared: SharedArrayBuffer; breakpoints: Record<string, number[]>; stopOnEntry?: boolean } };
  if (msg.type !== 'run') return;
  const ctl = new Int32Array(msg.shared, 0, 2); // [0] = state (0 waiting, 1 line ready), [1] = byte length
  const bytes = new Uint8Array(msg.shared, 8);
  try {
    post({ type: 'status', text: 'Loading Python…' });
    const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`);
    const py = await loadPyodide({ indexURL: PYODIDE });

    let buf: number[] = [];
    const flush = (kind: 'out' | 'err') => { if (buf.length) { post({ type: kind, text: dec.decode(new Uint8Array(buf)) }); buf = []; } };
    const sink = (kind: 'out' | 'err') => ({ raw: (b: number) => { buf.push(b); if (b === 10 || buf.length > 2048) flush(kind); } });
    py.setStdout(sink('out'));
    py.setStderr(sink('err'));
    py.setStdin({
      stdin: () => {
        flush('out');
        Atomics.store(ctl, 0, 0);
        post({ type: 'input' });
        Atomics.wait(ctl, 0, 0);
        const n = Atomics.load(ctl, 1);
        if (n < 0) return null; // end of input (the run was stopped)
        return dec.decode(bytes.slice(0, n));
      },
    });

    // the workspace files, so `import mymodule` and open('data.txt') work
    const root = '/home/pyodide';
    const before = new Map<string, number>();
    for (const [path, data] of Object.entries(msg.files)) {
      const full = root + path;
      py.FS.mkdirTree(full.slice(0, full.lastIndexOf('/')));
      py.FS.writeFile(full, data);
      before.set(path, data.length);
    }
    const code = dec.decode(msg.files[msg.path]);
    const dir = root + msg.path.slice(0, msg.path.lastIndexOf('/'));
    post({ type: 'status', text: 'Loading packages…' });
    await py.loadPackagesFromImports(code, { messageCallback: () => {}, errorCallback: () => {} }).catch(() => {});
    post({ type: 'status', text: '' });

    if (msg.debug) {
      // the debugger: sys.settrace pauses on a shared buffer (same protocol as the JavaScript debugger)
      const dctl = new Int32Array(msg.debug.shared, 0, 4);
      const dbytes = new Uint8Array(msg.debug.shared, 16);
      (self as any).__ide_dbg_wait = (payload: string) => {
        flush('out');
        if (payload) post({ type: 'paused', ...JSON.parse(payload) });
        Atomics.store(dctl, 0, 0);
        Atomics.wait(dctl, 0, 0);
        const cmd = Atomics.load(dctl, 1);
        if (cmd !== 6 && cmd !== 7 && cmd !== 5) post({ type: 'resumed' });
        return JSON.stringify({ cmd, text: dec.decode(dbytes.slice(0, Atomics.load(dctl, 2))) });
      };
      (self as any).__ide_dbg_eval = (payload: string) => post({ type: 'eval', ...JSON.parse(payload) });
      py.globals.set('__ide_bps', JSON.stringify(msg.debug.breakpoints));
      py.globals.set('__ide_entry', Boolean(msg.debug.stopOnEntry));
      py.globals.set('__ide_root', root);
      await py.runPythonAsync(DEBUGGER);
    }
    let exit = 0;
    try {
      py.globals.set('__ide_debug', Boolean(msg.debug));
      py.globals.set('__ide_code', code);
      py.globals.set('__ide_file', root + msg.path);
      py.globals.set('__ide_dir', dir || root);
      await py.runPythonAsync(`
import sys, os, traceback
class __IdeStop(BaseException): pass
if '__ide_tracer' in globals(): __IdeStop = globals()['__IdeStopDbg']
os.chdir(__ide_dir)
sys.path.insert(0, __ide_dir)
sys.argv = [__ide_file]
__ide_exit = 0
try:
    __ide_g = {'__name__': '__main__', '__file__': __ide_file}
    __ide_c = compile(__ide_code, __ide_file, 'exec')
    if __ide_debug:
        sys.settrace(__ide_tracer)
        try:
            exec(__ide_c, __ide_g)
        finally:
            sys.settrace(None)
    else:
        exec(__ide_c, __ide_g)
except __IdeStop:
    __ide_exit = 130
except SystemExit as e:
    __ide_exit = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
except BaseException:
    __ide_exit = 1
    et, ev, tb = sys.exc_info()
    traceback.print_exception(et, ev, tb.tb_next)
sys.stdout.flush(); sys.stderr.flush()
`);
      exit = Number(py.globals.get('__ide_exit') ?? 0);
    } catch (err) {
      exit = 1;
      buf.push(...enc.encode(String(err instanceof Error ? err.message : err) + '\n'));
    }
    flush('out');

    // files the program created or changed go back to the workspace
    const changed: Record<string, Uint8Array> = {};
    const walk = (d: string) => {
      for (const name of py.FS.readdir(d)) {
        if (name === '.' || name === '..' || name === '__pycache__' || name === 'node_modules' || name === '.git') continue;
        const full = `${d}/${name}`;
        const st = py.FS.stat(full);
        if (py.FS.isDir(st.mode)) walk(full);
        else {
          const rel = full.slice(root.length);
          const data: Uint8Array = py.FS.readFile(full);
          const old = msg.files[rel];
          if (!old || old.length !== data.length || old.some((b, i) => b !== data[i])) changed[rel] = data;
        }
      }
    };
    try { walk(root); } catch { /* nothing to sync */ }
    post({ type: 'done', exit, changed });
  } catch (err) {
    post({ type: 'err', text: `Python could not start: ${err instanceof Error ? err.message : err}\n` });
    post({ type: 'done', exit: 1, changed: {} });
  }
};

/** The Python side of the debugger: a trace function with breakpoints, stepping, variables and expression evaluation. */
const DEBUGGER = `
import sys, json, js

class __IdeStopDbg(BaseException):
    pass

__ide_state = {'bps': {k: set(v) for k, v in json.loads(__ide_bps).items()}, 'mode': 'into' if __ide_entry else 'run', 'depth': 0, 'last': None}

def __ide_short(v, n=200):
    try:
        r = repr(v)
    except Exception as e:
        r = '<repr failed: %s>' % e
    return r if len(r) <= n else r[:n] + '…'

def __ide_var(name, v, depth=0):
    d = {'name': str(name), 'value': __ide_short(v), 'type': type(v).__name__}
    if depth < 2:
        kids = None
        try:
            if isinstance(v, dict):
                kids = [(__ide_short(k, 40), x) for k, x in list(v.items())[:50]]
            elif isinstance(v, (list, tuple)):
                kids = [(str(i), x) for i, x in enumerate(v[:50])]
            elif isinstance(v, (set, frozenset)):
                kids = [(str(i), x) for i, x in enumerate(list(v)[:50])]
            elif hasattr(v, '__dict__') and not isinstance(v, type) and type(v).__module__ != 'builtins':
                kids = list(vars(v).items())[:50]
        except Exception:
            kids = None
        if kids:
            d['children'] = [__ide_var(k, x, depth + 1) for k, x in kids]
    return d

def __ide_rel(path):
    return path[len(__ide_root):] if path.startswith(__ide_root) else path

def __ide_frames(frame):
    out = []
    f = frame
    while f is not None and len(out) < 12:
        fn = f.f_code.co_filename
        if fn.startswith(__ide_root):
            loc = {k: v for k, v in f.f_locals.items() if not k.startswith('__')}
            out.append({'name': f.f_code.co_name if f.f_code.co_name != '<module>' else '(module)', 'file': __ide_rel(fn), 'line': f.f_lineno, 'vars': [__ide_var(k, v) for k, v in loc.items() if type(v).__name__ not in ('module', 'function', 'type', 'builtin_function_or_method')]})
        f = f.f_back
    return out

def __ide_depth(frame):
    n = 0
    f = frame
    while f is not None:
        if f.f_code.co_filename.startswith(__ide_root):
            n += 1
        f = f.f_back
    return n

def __ide_pause(frame, reason):
    st = __ide_state
    frames = __ide_frames(frame)
    payload = json.dumps({'reason': reason, 'file': __ide_rel(frame.f_code.co_filename), 'line': frame.f_lineno, 'frames': frames})
    while True:
        ans = json.loads(js.__ide_dbg_wait(payload))
        payload = ''
        cmd = ans['cmd']
        if cmd == 6:
            req = json.loads(ans['text'])
            f = frame
            i = 0
            while i < req.get('frame', 0) and f.f_back is not None:
                f = f.f_back
                if f.f_code.co_filename.startswith(__ide_root):
                    i += 1
            try:
                try:
                    val = eval(req['expr'], f.f_globals, f.f_locals)
                except SyntaxError:
                    exec(req['expr'], f.f_globals, f.f_locals)
                    val = None
                js.__ide_dbg_eval(json.dumps({'id': req['id'], 'ok': True, 'result': __ide_var(req['expr'], val)}))
            except BaseException as e:
                js.__ide_dbg_eval(json.dumps({'id': req['id'], 'ok': False, 'error': '%s: %s' % (type(e).__name__, e)}))
            continue
        if cmd == 7:
            st['bps'] = {k: set(v) for k, v in json.loads(ans['text']).items()}
            continue
        if cmd == 5:
            raise __IdeStopDbg()
        st['mode'] = {2: 'over', 3: 'into', 4: 'out'}.get(cmd, 'run')
        st['depth'] = __ide_depth(frame)
        return

def __ide_tracer(frame, event, arg):
    fn = frame.f_code.co_filename
    if not fn.startswith(__ide_root):
        return None
    if event == 'line':
        st = __ide_state
        line = frame.f_lineno
        key = (fn, line, id(frame))
        hit = line in st['bps'].get(__ide_rel(fn), ())
        d = __ide_depth(frame)
        step = st['mode'] == 'into' or (st['mode'] == 'over' and d <= st['depth']) or (st['mode'] == 'out' and d < st['depth'])
        if (hit and key != st['last']) or step:
            st['last'] = key
            __ide_pause(frame, 'breakpoint' if hit else 'step')
        elif not hit:
            st['last'] = None
    return __ide_tracer
`;
