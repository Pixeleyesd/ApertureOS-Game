// runs the story: chapters, beats, steps, hints, and every action a beat can do.

import { evaluate, normalizeAction } from './expr.js';
import { clock, fmtDate, fmtShort, fmtStamp, USER } from './state.js';

export class Engine {
  constructor(world) {
    this.w = world;
    this.state = world.state;
    this.fs = world.fs;
    this.story = world.story;
  }

  print(t) { this.w.print(t); }

  warn(msg) {
    if (this.state.warned.includes(msg)) return;
    this.state.warned.push(msg);
    console.warn('[story error]', msg);
    this.print(`[story error] ${msg}`);
  }

  env() { return { state: this.state, resolve: (p) => this.fs.resolve(this.state.cwd, p) }; }

  test(cond) {
    if (cond === undefined || cond === null || cond === true) return true;
    try { return evaluate(cond, this.env()); } catch (e) { this.warn(e.message); return false; }
  }

  chapter() { return this.story.chapters[this.state.chapter] || null; }

  // ---- chapters -------------------------------------------------------

  startChapter(id) {
    const s = this.state;
    const ch = this.story.chapters[id];
    if (!ch) return this.end();
    s.chapter = id;
    s.chapterT = 0;
    s.chapterRan = [];
    s.done = {};
    s.hintLevel = {};
    s.nudged = false;
    if (this.story.settings.show_chapter_titles !== false) {
      const n = this.story.order.indexOf(id) + 1;
      this.print(`\n-- chapter ${n}: ${ch.title || id} --`);
    }
    this.run(ch.on_start);
    this.evaluate();
  }

  finish(ch) {
    this.run(ch.on_done);
    if (this.state.chapter !== ch.id) return; // on_done jumped somewhere
    const idx = this.story.order.indexOf(ch.id);
    const next = ch.next || this.story.order[idx + 1];
    if (!next) return this.end();
    this.startChapter(next);
  }

  end() {
    this.state.chapter = 'end';
    this.state.flags.end_of_written_story = true;
    this.print('\n-- end of the chapters written so far. more soon. --');
  }

  // ---- ticking --------------------------------------------------------

  tick(dt) {
    const s = this.state;
    s.t += dt; s.chapterT += dt; s.idleT += dt;
    const ch = this.chapter();
    if (!ch) return;
    const limit = ch.idle_nudge ?? this.story.settings.idle_nudge ?? 90;
    if (limit && s.idleT >= limit && !s.nudged) {
      s.nudged = true;
      this.print('[help desk] Still there, Doug? If you are stuck, type  hint  and I will nudge you along.');
    }
    this.evaluate();
  }

  // call after the player runs a command
  afterCommand(line) {
    const s = this.state;
    s.idleT = 0; s.nudged = false;
    const norm = line.replace(/\s+/g, ' ').trim();
    if (norm) { s.chapterRan.push(norm); s.ran.push(norm); }
    this.evaluate();
  }

  evaluate() {
    const s = this.state;
    for (let pass = 0; pass < 6; pass++) {
      const ch = this.chapter();
      if (!ch) return;
      let fired = false;
      const beats = ch.beats || [];
      for (let idx = 0; idx < beats.length; idx++) {
        const b = beats[idx];
        const key = b.id || String(idx);
        if (s.done[key]) continue;
        if (this.test(b.when)) {
          s.done[key] = true;
          fired = true;
          this.run(b.do);
          if (s.chapter !== ch.id) return;
        }
      }
      if (ch.done_when && this.test(ch.done_when)) { this.finish(ch); return; }
      if (!fired) return;
    }
  }

  // ---- steps and hints -----------------------------------------------

  steps() {
    const ch = this.chapter();
    if (!ch || !Array.isArray(ch.steps)) return [];
    return ch.steps.map((st, i) => ({
      key: String(i), text: st.text, final: !!st.final, hints: st.hints || [],
      done: this.test(st.done),
    }));
  }

  nextStep() { return this.steps().find((x) => !x.done) || null; }

  hint() {
    const s = this.state;
    const ch = this.chapter();
    if (!ch) return 'Nothing to hint at right now.';
    const st = this.nextStep();
    const list = (st && st.hints.length ? st.hints : ch.hints) || [];
    if (!list.length) return 'No hints written for this part. Try  help  or  ticket show.';
    const key = st ? st.key : 'chapter';
    const lvl = Math.min(s.hintLevel[key] || 0, list.length - 1);
    s.hintLevel[key] = Math.min((s.hintLevel[key] || 0) + 1, list.length);
    const head = st ? `Step: ${st.text}\n` : '';
    const tail = lvl === list.length - 1 ? '' : '\n(type hint again for a clearer one)';
    return `${head}Hint ${lvl + 1}/${list.length}: ${list[lvl]}${tail}`;
  }

  // ---- actions --------------------------------------------------------

  run(actions) {
    if (!actions) return;
    for (const a of actions) {
      let act;
      try { act = normalizeAction(a); } catch (e) { this.warn(e.message); continue; }
      const fn = this.actions[act.cmd];
      if (!fn) { this.warn(`unknown action "${act.cmd}"`); continue; }
      try { fn.call(this, act.args); } catch (e) { this.warn(`action ${act.cmd}: ${e.message}`); }
    }
  }

  get actions() {
    return {
      say(args) { this.print(String(args.join(' ')).replace(/\n$/, '')); },

      tip(args) { if (this.state.flags.beginner) this.print(`[tip] ${String(args.join(' ')).replace(/\n$/, '')}`); },

      wall(args) {
        const from = args.length > 1 ? args[0] : 'glados';
        const text = String(args[args.length - 1]).replace(/\n$/, '');
        const d = fmtDate(clock(this.state));
        this.print(`\nBroadcast message from ${from}@central (${d}):\n\n${text}\n`);
      },

      log(args) {
        const [file, text] = args;
        const p = `/var/log/${file}`;
        this.fs.write(p, `[${fmtStamp(clock(this.state))}] ${String(text).replace(/\n$/, '')}\n`, true);
      },

      mail(args) {
        const def = this.w.mailDefs[args[0]];
        if (!def) throw new Error(`no mail file for "${args[0]}"`);
        if (this.state.mail.some((m) => m.id === args[0])) return;
        this.state.mail.push({
          id: args[0], from: def.from, subject: def.subject, body: def.body || '',
          date: fmtShort(clock(this.state)),
        });
        if (args[1] !== 'quiet') this.print('You have new mail. Type  mail  to read it.');
      },

      set(args) {
        const m = args.join(' ').match(/^(\S+?)\s*=\s*(.*)$/);
        if (!m) throw new Error(`set wants  name = value, got "${args.join(' ')}"`);
        const [, target, raw] = m;
        let v = raw.trim();
        if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^-?\d+$/.test(v)) v = Number(v);
        const s = this.state;
        if (target.startsWith('flag.')) s.flags[target.slice(5)] = v;
        else if (target.startsWith('gone.')) s.gone[target.slice(5)] = v;
        else if (target === 'headcount') s.headcount = v;
        else if (target === 'core') s.core = v === 'none' ? null : v;
        else throw new Error(`can't set "${target}" (use flag.x, gone.login, headcount or core)`);
      },

      write(args) { this.fs.write(this.fs.resolve('/', args[0]), String(args[1])); },
      append(args) { this.fs.write(this.fs.resolve('/', args[0]), String(args[1]), true); },

      unlock(args) {
        const p = this.fs.resolve('/', args[0]);
        const n = this.fs.get(p);
        if (!n) throw new Error(`nothing at ${p}`);
        n.locked = false;
        if (!this.state.unlocked.includes(p)) this.state.unlocked.push(p);
      },

      unlock_cmd(args) { for (const c of args) this.state.cmds[c] = true; },
      lock_cmd(args) { for (const c of args) this.state.cmds[c] = false; },
      prompt(args) { this.state.prompt = args[0] === undefined || args[0] === 'default' ? null : String(args[0]); },
      goto(args) { this.startChapter(args[0]); },
      next() { const ch = this.chapter(); if (ch) this.finish(ch); },
    };
  }
}

export { USER };
