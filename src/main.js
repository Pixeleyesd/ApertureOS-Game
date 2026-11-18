import { createWorld } from './world.js';
import { Terminal } from './terminal.js';

const KEY = 'apertureos-save-v1';

// a 404 means "that file isn't written yet" and is algs. a 5xx or a dropped connection is usually the host selling. Github Pages has done this to me a buncha times, just redeploy and try again.
async function load(path) {
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(path, { cache: 'no-cache' });
      if (r.status === 404) return null;
      if (r.ok) return r.text();
      last = new Error(`${path}: ${r.status}`);
      if (r.status < 500) break;
    } catch (e) { last = e; }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  throw last;
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
  term.onInterrupt = () => world.stopFollow();
  term.onLine = (line) => {
    world.stopFollow(); // running anything else ends a tail -f, like leaving it would
    shell.run(line);
    engine.afterCommand(line);
    world.pump();
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
    world.pump(); // lines for tail -f / journalctl -f
    refresh();
    if (++n % 10 === 0) save();
  }, 1000);
}

start();
