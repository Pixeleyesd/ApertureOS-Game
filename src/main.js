import { createWorld } from './world.js';
import { Terminal } from './terminal.js';

const KEY = 'apertureos-save-v1';

async function load(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.text();
}

const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode etc */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

async function start() {
  const term = new Terminal();
  const print = (t, kind) => term.print(t, kind);

  let saved = store.get();
  let world;
  try { world = await createWorld({ load, print, saved }); }
  catch (e) {
    if (saved) {
      // an old or broken save should never lock someone out
      store.clear(); saved = null;
      try { world = await createWorld({ load, print, saved }); } catch (e2) { e = e2; }
    }
    if (!world) {
      term.print(`The terminal could not start: ${e.message}\n\nIf you opened index.html straight from a folder, serve the folder instead:\n  python3 -m http.server\nthen open http://localhost:8000`);
      return;
    }
  }

  const { state, shell, engine } = world;
  world.clear = () => term.clear();
  world.reset = () => { store.clear(); location.reload(); };

  const refresh = () => { term.setPrompt(shell.prompt()); shell.cols = term.cols(); };
  const save = () => store.set(world.save());

  term.onActivity = () => { state.idleT = 0; state.nudged = false; };
  term.complete = (before) => shell.complete(before);
  term.onLine = (line) => {
    shell.run(line);
    engine.afterCommand(line);
    refresh(); save();
  };
  window.addEventListener('resize', refresh);

  if (saved && saved.chapter) { term.setHistory(state.ran); world.restore(); }
  else world.boot();
  refresh(); save();
  term.input.disabled = false; // typing is only allowed once the shift has loaded
  term.input.focus();

  let n = 0;
  setInterval(() => {
    if (document.hidden) return; // nothing happens while the tab is in the background
    engine.tick(1);
    refresh();
    if (++n % 10 === 0) save();
  }, 1000);
}

start();
