// conditions ("ran ls and flag.x") and action parsing for the story files.

const TOK = /\s*(?:("(?:[^"\\]|\\.)*")|(<=|>=|==|!=|<|>|=|\(|\))|([^\s()<>=!"]+))/y;

export function tokenize(s) {
  const out = [];
  TOK.lastIndex = 0;
  let m;
  while (TOK.lastIndex < s.length && (m = TOK.exec(s))) {
    if (m[1] !== undefined) {
      let v; try { v = JSON.parse(m[1]); } catch { v = m[1].slice(1, -1); }
      out.push({ t: 'str', v });
    } else if (m[2]) out.push({ t: 'op', v: m[2] });
    else out.push({ t: 'word', v: m[3] });
  }
  return out;
}

// an action is either a string  ->  say "hello"
// or a one-key map              ->  say: hello
export function normalizeAction(a) {
  if (typeof a === 'string') {
    const t = tokenize(a);
    if (!t.length) throw new Error(`empty action`);
    return { cmd: t[0].v, args: t.slice(1).map((x) => x.v) };
  }
  if (a && typeof a === 'object') {
    const keys = Object.keys(a);
    if (keys.length !== 1) throw new Error(`an action needs exactly one key, got: ${keys.join(', ')}`);
    const v = a[keys[0]];
    return { cmd: keys[0], args: Array.isArray(v) ? v : (v === null ? [] : [v]) };
  }
  throw new Error(`can't read action: ${JSON.stringify(a)}`);
}

const cmp = (op, a, b) => ({ '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b, '==': a === b, '!=': a !== b }[op]);

// env: { state, resolve(path) }
export function evaluate(src, env) {
  const toks = tokenize(String(src));
  let p = 0;
  const next = () => toks[p++];
  const isWord = (v) => toks[p] && toks[p].t === 'word' && toks[p].v === v;
  const need = (what) => { const t = next(); if (!t) throw new Error(`"${src}" ended early, expected ${what}`); return t.v; };
  const s = env.state;

  function or() { let l = and(); while (isWord('or')) { p++; const r = and(); l = l || r; } return l; }
  function and() { let l = not(); while (isWord('and')) { p++; const r = not(); l = l && r; } return l; }
  function not() { if (isWord('not')) { p++; return !not(); } return atom(); }

  function atom() {
    const t = next();
    if (!t) throw new Error(`"${src}" ended early`);
    if (t.t === 'op' && t.v === '(') { const v = or(); if (need(')') !== ')') throw new Error(`missing ) in "${src}"`); return v; }
    if (t.t !== 'word') throw new Error(`unexpected ${t.v} in "${src}"`);
    const w = t.v;
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (w.startsWith('flag.')) return !!s.flags[w.slice(5)];
    switch (w) {
      case 'ran': { const c = need('a command').replace(/\s+/g, ' ').trim(); return s.chapterRan.some((l) => l === c || l.startsWith(c + ' ')); }
      case 'read': return s.read.includes(env.resolve(need('a path')));
      case 'visited': return s.visited.includes(env.resolve(need('a path')));
      case 'wrote': return s.chapterWrote.includes(env.resolve(need('a path')));
      case 'seen': return (s.chapterRead || []).includes(env.resolve(need('a path')));
      case 'after': {
        const f = need('a flag').replace(/^flag\./, '');
        const n = Number(need('seconds'));
        return !!s.flags[f] && s.flagAt && s.flagAt[f] !== undefined && s.t - s.flagAt[f] >= n;
      }
      case 'cwd': return s.cwd === env.resolve(need('a path'));
      case 'idle': return s.idleT >= Number(need('seconds'));
      case 'since': return s.chapterT >= Number(need('seconds'));
      case 'headcount': { const op = need('a comparison'); return cmp(op, s.headcount, Number(need('a number'))); }
      case 'mail_read': return !!s.mailRead[need('a mail id')];
      case 'core': return s.core === need('a core name');
      default: throw new Error(`don't know the condition "${w}" in "${src}"`);
    }
  }

  const v = or();
  if (p < toks.length) throw new Error(`leftover "${toks[p].v}" in "${src}"`);
  return v;
}
