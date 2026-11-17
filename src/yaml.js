// tiny YAML reader. only handles what the story files use:
// maps, lists, quoted and plain scalars, | and > blocks, [a, b] lists, # comments.
// errors say which line broke so story files are easy to fix.

export function parse(src, name = 'yaml') {
  const lines = String(src).replace(/\r/g, '').split('\n');
  let i = 0;
  const fail = (msg) => { throw new Error(`${name} line ${i + 1}: ${msg}`); };
  const blank = (l) => /^\s*(#.*)?$/.test(l);
  const indentOf = (l) => l.length - l.trimStart().length;
  const isDash = (t) => t === '-' || t.startsWith('- ');
  const KEY = /^([A-Za-z0-9_.\/\-]+):(?:\s+(.*))?$/;

  function skip() { while (i < lines.length && blank(lines[i])) i++; }

  function block(minIndent) {
    skip();
    if (i >= lines.length) return null;
    const ind = indentOf(lines[i]);
    if (ind < minIndent) return null;
    return isDash(lines[i].trim()) ? list(ind) : map(ind);
  }

  function list(ind) {
    const out = [];
    for (;;) {
      skip();
      if (i >= lines.length || indentOf(lines[i]) !== ind) break;
      const t = lines[i].trim();
      if (!isDash(t)) break;
      const rest = t.slice(1).trim();
      if (rest === '' || rest.startsWith('#')) { i++; out.push(block(ind + 1)); continue; }
      if (/^[|>][+-]?$/.test(rest)) { i++; out.push(blockScalar(rest, ind)); continue; }
      if (KEY.test(rest)) {
        lines[i] = ' '.repeat(ind + 2) + rest;
        out.push(map(ind + 2));
      } else { i++; out.push(scalar(rest)); }
    }
    return out;
  }

  function map(ind) {
    const out = {};
    for (;;) {
      skip();
      if (i >= lines.length || indentOf(lines[i]) !== ind) break;
      const m = lines[i].trim().match(KEY);
      if (!m) fail(`expected "key: value" but got "${lines[i].trim()}"`);
      const key = m[1];
      let rest = (m[2] ?? '').trim();
      if (rest.startsWith('#')) rest = '';
      i++;
      if (/^[|>][+-]?$/.test(rest)) { out[key] = blockScalar(rest, ind); continue; }
      if (rest === '') {
        skip();
        if (i < lines.length) {
          const ni = indentOf(lines[i]);
          if (ni > ind) { out[key] = block(ind + 1); continue; }
          if (ni === ind && isDash(lines[i].trim())) { out[key] = block(ind); continue; }
        }
        out[key] = null;
        continue;
      }
      out[key] = scalar(rest);
    }
    return out;
  }

  function blockScalar(style, parentInd) {
    const buf = [];
    while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > parentInd)) { buf.push(lines[i]); i++; }
    let end = buf.length;
    while (end > 0 && buf[end - 1].trim() === '') end--;
    const body = buf.slice(0, end);
    const real = body.filter((l) => l.trim() !== '');
    const strip = real.length ? Math.min(...real.map(indentOf)) : 0;
    const rows = body.map((l) => l.slice(strip));
    let text;
    if (style[0] === '|') text = rows.join('\n');
    else {
      const paras = [[]];
      for (const r of rows) { if (r.trim() === '') paras.push([]); else paras[paras.length - 1].push(r.trim()); }
      text = paras.map((p) => p.join(' ')).join('\n');
    }
    return style.endsWith('-') ? text : text + '\n';
  }

  function stripComment(s) {
    let q = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (q) { if (c === '\\' && q === '"') k++; else if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '#' && k > 0 && /\s/.test(s[k - 1])) return s.slice(0, k).trim();
    }
    return s.trim();
  }

  function closeQuote(s) {
    const q = s[0];
    for (let k = 1; k < s.length; k++) {
      if (q === '"' && s[k] === '\\') { k++; continue; }
      if (s[k] === q) {
        if (q === "'" && s[k + 1] === "'") { k++; continue; }
        return k;
      }
    }
    return -1;
  }

  function scalar(s) {
    s = s.trim();
    if (s[0] === '"' || s[0] === "'") {
      const e = closeQuote(s);
      if (e < 0) fail('quote was never closed');
      const after = s.slice(e + 1).trim();
      if (after === '' || after.startsWith('#')) {
        const body = s.slice(0, e + 1);
        if (s[0] === "'") return body.slice(1, -1).replace(/''/g, "'");
        try { return JSON.parse(body); } catch { return body.slice(1, -1); }
      }
      return stripComment(s);
    }
    s = stripComment(s);
    if (s[0] === '[' && s.endsWith(']')) return flow(s.slice(1, -1));
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~' || s === '') return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  function flow(inner) {
    const parts = []; let cur = ''; let q = null;
    for (const c of inner) {
      if (q) { cur += c; if (c === q) q = null; }
      else if (c === '"' || c === "'") { q = c; cur += c; }
      else if (c === ',') { parts.push(cur); cur = ''; }
      else cur += c;
    }
    if (cur.trim() !== '') parts.push(cur);
    return parts.map((p) => scalar(p));
  }

  const v = block(0);
  return v ?? {};
}
