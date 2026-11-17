// the shell: parsing, quotes, pipes, redirects, globbing, completion.
// not a real shell, just enough of one that it behaves the way people expect.

import { USER, HOST } from './state.js';

export class ShellError extends Error {}

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
    {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // swapping two neighbouring letters (sl for ls) counts as one typo
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

export class Shell {
  constructor(world, defs) {
    this.w = world;
    this.state = world.state;
    this.fs = world.fs;
    this.defs = new Map();
    for (const d of defs) { this.defs.set(d.name, d); for (const a of d.aliases || []) this.defs.set(a, d); }
    this.cols = 80;
  }

  // ---- small helpers --------------------------------------------------

  available(def) {
    const o = this.state.cmds[def.name];
    return def.locked ? o === true : o !== false;
  }

  names() { return [...this.defs.keys()].filter((n) => this.available(this.defs.get(n))).sort(); }

  cwdShown() {
    const s = this.state, h = this.fs.home;
    if (s.cwd === h) return '~';
    return s.cwd.startsWith(h + '/') ? '~' + s.cwd.slice(h.length) : s.cwd;
  }

  prompt() {
    const s = this.state;
    if (s.prompt) return s.prompt.replace('{user}', USER).replace('{host}', HOST).replace('{cwd}', this.cwdShown());
    return `${USER}@${HOST}:${this.cwdShown()}$ `;
  }

  expandVars(t) {
    const v = { USER, HOME: this.fs.home, PWD: this.state.cwd, HOSTNAME: HOST, SHELL: '/bin/bash' };
    return t.replace(/\$\{?([A-Za-z_]+)\}?/g, (m, k) => (k in v ? v[k] : ''));
  }

  // ---- parsing --------------------------------------------------------

  lex(line) {
    const toks = [];
    let cur = null;
    const push = () => {
      if (!cur) return;
      if (!cur.quoted && (cur.v === '~' || cur.v.startsWith('~/'))) cur.v = this.fs.home + cur.v.slice(1);
      toks.push(cur); cur = null;
    };
    let i = 0;
    while (i < line.length) {
      const c = line[i];
      if (c === ' ' || c === '\t') { push(); i++; continue; }
      if (c === '|') { push(); toks.push({ op: '|' }); i++; continue; }
      if (c === ';') { push(); toks.push({ op: ';' }); i++; continue; }
      if (c === '&' && line[i + 1] === '&') { push(); toks.push({ op: ';' }); i += 2; continue; }
      if (c === '>') { push(); if (line[i + 1] === '>') { toks.push({ op: '>>' }); i += 2; } else { toks.push({ op: '>' }); i++; } continue; }
      cur = cur || { v: '', quoted: false };
      if (c === "'") {
        const e = line.indexOf("'", i + 1);
        if (e < 0) throw new ShellError("a ' was opened but never closed. Close it with another '.");
        cur.v += line.slice(i + 1, e); cur.quoted = true; i = e + 1;
      } else if (c === '"') {
        let j = i + 1, s = '';
        while (j < line.length && line[j] !== '"') { if (line[j] === '\\' && j + 1 < line.length) j++; s += line[j]; j++; }
        if (j >= line.length) throw new ShellError('a " was opened but never closed. Close it with another ".');
        cur.v += this.expandVars(s); cur.quoted = true; i = j + 1;
      } else if (c === '\\') {
        cur.v += line[i + 1] ?? ''; cur.quoted = true; i += 2;
      } else {
        let j = i, s = '';
        while (j < line.length && !' \t|;>"\'\\'.includes(line[j]) && !(line[j] === '&' && line[j + 1] === '&')) { s += line[j]; j++; }
        cur.v += this.expandVars(s); i = j;
      }
    }
    push();
    return toks;
  }

  parse(line) {
    const toks = this.lex(line);
    const lists = [[{ argv: [], redirect: null }]];
    const stage = () => { const l = lists[lists.length - 1]; return l[l.length - 1]; };
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (!t.op) { stage().argv.push(t); continue; }
      if (t.op === '|') {
        if (!stage().argv.length) throw new ShellError("there's nothing before that | to pipe from.");
        lists[lists.length - 1].push({ argv: [], redirect: null });
      } else if (t.op === ';') {
        lists.push([{ argv: [], redirect: null }]);
      } else {
        const target = toks[k + 1];
        if (!target || target.op) throw new ShellError(`${t.op} needs a file name after it, like:  echo hi ${t.op} notes.txt`);
        stage().redirect = { op: t.op, file: target.v };
        k++;
      }
    }
    return lists.map((l) => l.filter((s) => s.argv.length || s.redirect));
  }

  glob(tokens) {
    const out = [];
    for (const t of tokens) {
      if (t.quoted || !/[*?]/.test(t.v)) { out.push(t.v); continue; }
      const slash = t.v.lastIndexOf('/');
      const dirTyped = slash >= 0 ? t.v.slice(0, slash + 1) : '';
      const pat = t.v.slice(slash + 1);
      const dir = this.fs.resolve(this.state.cwd, dirTyped || '.');
      const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      const hits = this.fs.list(dir).filter((n) => re.test(n) && (pat.startsWith('.') || !n.startsWith('.')));
      if (hits.length) out.push(...hits.map((n) => dirTyped + n)); else out.push(t.v);
    }
    return out;
  }

  // ---- running --------------------------------------------------------

  ctx(stdin) {
    return {
      state: this.state, fs: this.fs, shell: this, w: this.w, engine: this.w.engine,
      stdin, cols: this.cols,
      print: (t) => this.w.print(t),
      abs: (p) => this.fs.resolve(this.state.cwd, p),
    };
  }

  notFound(name) {
    // short names only forgive one typo, longer ones forgive two
    let best = null, bd = name.length <= 3 ? 2 : 3;
    for (const n of this.names()) {
      const d = distance(name, n);
      if (d < bd && n.length > 1) { best = n; bd = d; }
    }
    const tip = best ? `Did you mean "${best}"? ` : '';
    return `bash: ${name}: command not found\n${tip}Type "help" to see what you can do from here.`;
  }

  exec(stage, stdin) {
    const argv = this.glob(stage.argv);
    if (!argv.length) return undefined;
    const def = this.defs.get(argv[0]);
    if (!def) { this.w.print(this.notFound(argv[0]), 'err'); return undefined; }
    if (!this.available(def)) {
      this.w.print(def.lockedMsg || `${def.name}: your clearance does not cover this yet.`, 'err');
      return undefined;
    }
    try {
      return def.run(argv.slice(1), this.ctx(stdin));
    } catch (e) {
      if (e instanceof ShellError) this.w.print(e.message, 'err');
      else { console.error(e); this.w.print(`${def.name}: the terminal tripped over itself (${e.message}).`, 'err'); }
      return undefined;
    }
  }

  deliver(stage, out) {
    if (out === undefined) return;
    const text = String(out).replace(/\n$/, '');
    if (!stage.redirect) {
      // ls and tree get their folder names picked out
      const name = stage.argv[0] && stage.argv[0].v;
      this.w.print(text, name === 'ls' || name === 'tree' ? 'ls' : '');
      return;
    }
    const { op, file } = stage.redirect;
    const abs = this.fs.resolve(this.state.cwd, file);
    const home = this.fs.home;
    if (!(abs === home || abs.startsWith(home + '/') || abs.startsWith('/tmp/'))) {
      this.w.print(`bash: ${file}: Permission denied\n(This account can only write inside your home folder, ~)`, 'err');
      return;
    }
    try { this.fs.write(abs, text + '\n', op === '>>'); }
    catch (e) { this.w.print(`bash: ${file}: ${e.message}`, 'err'); }
  }

  run(line) {
    if (!line.trim()) return;
    let lists;
    try { lists = this.parse(line); } catch (e) { this.w.print(e.message, 'err'); return; }
    for (const pipeline of lists) {
      let input;
      pipeline.forEach((st, k) => {
        const out = this.exec(st, input);
        input = out === undefined ? '' : String(out);
        if (k === pipeline.length - 1) this.deliver(st, out);
      });
    }
  }

  // ---- tab completion -------------------------------------------------

  // returns { start, matches } where matches replace line[start..cursor]
  complete(before) {
    const m = before.match(/(?:^|[\s|;])([^\s|;]*)$/);
    const word = m ? m[1] : '';
    const start = before.length - word.length;
    const head = before.slice(0, start).trim();
    const isCmd = head === '' || /[|;]$/.test(head) || head.endsWith('&&');
    if (isCmd && !word.includes('/')) {
      return { start, matches: this.names().filter((n) => n.startsWith(word)) };
    }
    const slash = word.lastIndexOf('/');
    const dirTyped = slash >= 0 ? word.slice(0, slash + 1) : '';
    const base = word.slice(slash + 1);
    const dir = this.fs.resolve(this.state.cwd, dirTyped || '.');
    if (this.fs.lockedAt(dir)) return { start, matches: [] };
    const names = this.fs.list(dir).filter((n) => n.startsWith(base) && (base.startsWith('.') || !n.startsWith('.')));
    return { start, matches: names.map((n) => dirTyped + n + (this.fs.isDir(dir + '/' + n) ? '/' : '')) };
  }
}
