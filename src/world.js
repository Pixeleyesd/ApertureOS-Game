// loads everything (story, fake disk, commands) and wires it together.
// this file never touches the browser, so tests can run it in node.

import { parse } from './yaml.js';
import { FS } from './fs.js';
import { newState, clock, fmtDate } from './state.js';
import { Engine } from './engine.js';
import { Shell } from './shell.js';
import { normalizeAction } from './expr.js';
import commands from './commands/index.js';

// files whose contents come from the game state instead of from text
const DYNAMIC = {
  headcount: (w) => () => String(w.state.headcount),
  core: (w) => () => w.state.core || 'none',
  power: (w) => () => (w.state.flags.glados_awake ? 'ONLINE' : 'STANDBY'),
  mailbox: (w) => () => w.state.mail.map((m) => `From: ${m.from}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.body}`).join('\n'),
};

// load(path) -> Promise<string | null>   (null means "no such file")
export async function createWorld({ load, print, saved = null }) {
  const text = async (p, required = true) => {
    const t = await load(p);
    if (t === null || t === undefined) { if (required) throw new Error(`missing file: ${p}`); return null; }
    return t;
  };
  const doc = async (p, required = true) => { const t = await text(p, required); return t === null ? null : parse(t, p); };

  // story
  const storyDoc = await doc('story/story.yml');
  const chapters = {}; const order = [];
  for (const name of storyDoc.chapters || []) {
    const c = await doc(`story/chapters/${name}.yml`, false);
    if (!c) continue; // listed but not written yet
    c.id = c.id || name;
    chapters[c.id] = c; order.push(c.id);
  }
  const mailIds = new Set();
  const scan = (list) => (list || []).forEach((a) => { try { const n = normalizeAction(a); if (n.cmd === 'mail') mailIds.add(n.args[0]); } catch { /* reported when it runs */ } });
  for (const c of Object.values(chapters)) { scan(c.on_start); scan(c.on_done); (c.beats || []).forEach((b) => scan(b.do)); }
  const mailDefs = {};
  for (const id of mailIds) mailDefs[id] = await doc(`story/mail/${id}.yml`);
  const characters = (await doc('story/characters.yml')).people || [];

  const state = saved ? Object.assign(newState(), saved) : newState();
  const world = {
    state, print, characters, mailDefs,
    story: { order, chapters, settings: storyDoc },
    clear() {}, reset() {},
  };

  // fake disk
  const man = await doc('content/filesystem.yml');
  const fs = new FS(man.home);
  for (const d of man.dirs || []) fs.mkdirp(d);
  for (const f of man.files || []) {
    if (f.dynamic) {
      if (!DYNAMIC[f.dynamic]) throw new Error(`content/filesystem.yml: unknown dynamic "${f.dynamic}"`);
      fs.put(f.path, '', { dynamic: DYNAMIC[f.dynamic](world) });
    } else fs.put(f.path, await text('content/fs/' + f.src));
  }
  for (const p of man.locked || []) { const n = fs.get(p); if (n) n.locked = true; }
  for (const [p, c] of Object.entries(state.patches)) { try { fs.write(p, c); } catch { /* skip */ } }
  for (const p of state.unlocked) { const n = fs.get(p); if (n) n.locked = false; }
  fs.onWrite = (p, c) => {
    state.patches[p] = c;
    if (!state.chapterWrote.includes(p)) state.chapterWrote.push(p);
  };
  world.fs = fs;

  world.engine = new Engine(world);
  world.shell = new Shell(world, commands);

  world.boot = () => {
    print('Aperture Science Enrichment Center\nMaintenance Annex, terminal 03 (tty1)\n\nlogin: drattman\nLast login: Thu Mar  3 17:02:44 2011 from annex-gate\n');
    print(fs.read('/etc/motd').replace(/\n$/, ''));
    world.engine.startChapter(order[0]);
  };
  world.restore = () => print('Session restored. Type "help" if you need to find your place.');

  // tail -f and journalctl -f: the terminal "follows" a file, printing new lines as the
  // story adds them, until Ctrl+C (or two minutes, so nobody gets stuck on a phone).
  world.follow = null;
  world.startFollow = (abs) => { world.follow = { abs, shown: fs.read(abs).length, ticks: 0 }; };
  world.stopFollow = () => { world.follow = null; };
  world.pump = () => {
    const f = world.follow;
    if (!f) return;
    const text = fs.read(f.abs);
    if (text.length < f.shown) f.shown = text.length;
    if (text.length > f.shown) { print(text.slice(f.shown).replace(/\n$/, '')); f.shown = text.length; }
    if (++f.ticks >= 120) { world.follow = null; print('(stopped following after two minutes)'); }
  };
  world.save = () => JSON.parse(JSON.stringify(state));
  return world;
}
