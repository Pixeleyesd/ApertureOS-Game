// the screen: output lines, one input line at the bottom, history, tab completion.
// the input is a real <input> so typing, selecting and pasting behave natively.
//
// print(text, kind) -- kind picks a shade:
//   ''     normal output
//   'err'  something went wrong (red-orange, with the "(try ...)" lines dimmed)
//   'tip'  [tip] and help-desk lines (dim)
//   'wall' broadcast messages (bold)
//   'ls'   ls / tree output (folder names stand out)

const span = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };

export class Terminal {
  constructor() {
    this.out = document.getElementById('out');
    this.promptEl = document.getElementById('prompt');
    this.input = document.getElementById('in');
    this.screen = document.getElementById('screen');
    this.prompt = '';
    this.history = [];
    this.pos = 0;
    this.draft = '';
    this.lastTab = null;
    // set by main.js
    this.onLine = () => {};
    this.complete = () => ({ start: 0, matches: [] });
    this.onActivity = () => {};

    this.screen.addEventListener('click', () => { if (!String(window.getSelection())) this.input.focus(); });
    this.input.addEventListener('keydown', (e) => this.key(e));
    this.input.addEventListener('input', () => { this.lastTab = null; this.onActivity(); });
    this.input.focus();
  }

  // "drattman@annex-03:~/tickets$ " -> coloured pieces. anything else is shown plain.
  fillPrompt(el) {
    el.textContent = '';
    const m = this.prompt.match(/^(\S+@\S+?):(.*?)(\$ |# |> )$/);
    if (!m) { el.textContent = this.prompt; return; }
    el.append(span('user', m[1]), ':', span('path', m[2]), m[3]);
  }

  setPrompt(p) { this.prompt = p; this.fillPrompt(this.promptEl); }
  setHistory(h) { this.history = h.slice(); this.pos = this.history.length; }

  cols() {
    const probe = document.createElement('span');
    probe.textContent = '0'.repeat(20);
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    this.out.appendChild(probe);
    const w = probe.getBoundingClientRect().width / 20;
    probe.remove();
    return Math.max(20, Math.floor(this.out.clientWidth / (w || 9)));
  }

  add(d) {
    this.out.appendChild(d);
    while (this.out.childNodes.length > 1500) this.out.removeChild(this.out.firstChild);
    this.scroll();
  }

  print(text, kind = '') {
    const d = document.createElement('div');
    d.className = 'block' + (kind ? ' ' + kind : '');
    if (text === '') d.textContent = ' ';
    else if (kind === 'ls') {
      text.split(/(\S+\/(?=\s|$))/).forEach((part, i) => d.append(i % 2 ? span('dir', part) : part));
    } else if (kind === 'err') {
      text.split('\n').forEach((line, i, all) => {
        const soft = /^(\(|Did you mean|Type )/.test(line);
        d.append(span(soft ? 'soft' : '', line + (i < all.length - 1 ? '\n' : '')));
      });
    } else d.textContent = text;
    this.add(d);
  }

  // a line the player typed, shown the way a real terminal leaves it behind
  echo(text) {
    const d = document.createElement('div');
    d.className = 'block';
    this.fillPrompt(d);
    d.append(span('cmd', text));
    this.add(d);
  }

  clear() { this.out.textContent = ''; }
  scroll() { window.scrollTo(0, document.documentElement.scrollHeight); }

  key(e) {
    const el = this.input;
    if (e.key !== 'Tab') this.lastTab = null;
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = el.value;
      this.echo(line);
      el.value = '';
      if (line.trim() && this.history[this.history.length - 1] !== line) this.history.push(line);
      this.pos = this.history.length; this.draft = '';
      this.onActivity();
      this.onLine(line);
      this.scroll();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.pos === this.history.length) this.draft = el.value;
      if (this.pos > 0) { this.pos--; el.value = this.history[this.pos]; }
      this.cursorEnd();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.pos < this.history.length) { this.pos++; el.value = this.pos === this.history.length ? this.draft : this.history[this.pos]; }
      this.cursorEnd();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.tab();
    } else if (e.ctrlKey && !e.altKey && !e.metaKey) {
      const k = e.key.toLowerCase();
      const at = el.selectionStart;
      if (k === 'l') { e.preventDefault(); this.clear(); }
      else if (k === 'c' && el.selectionStart === el.selectionEnd) { e.preventDefault(); this.echo(el.value + '^C'); el.value = ''; this.pos = this.history.length; }
      else if (k === 'a') { e.preventDefault(); el.setSelectionRange(0, 0); }
      else if (k === 'e') { e.preventDefault(); this.cursorEnd(); }
      else if (k === 'u') { e.preventDefault(); el.value = el.value.slice(at); el.setSelectionRange(0, 0); }
      else if (k === 'k') { e.preventDefault(); el.value = el.value.slice(0, at); }
      else if (k === 'w') {
        e.preventDefault();
        const before = el.value.slice(0, at).replace(/\S+\s*$/, '');
        el.value = before + el.value.slice(at);
        el.setSelectionRange(before.length, before.length);
      }
    }
  }

  cursorEnd() { const n = this.input.value.length; setTimeout(() => this.input.setSelectionRange(n, n), 0); }

  tab() {
    const el = this.input;
    const at = el.selectionStart;
    const before = el.value.slice(0, at), after = el.value.slice(at);
    const { start, matches } = this.complete(before);
    if (!matches.length) return;
    const word = before.slice(start);
    let common = matches[0];
    for (const m of matches) { while (!m.startsWith(common)) common = common.slice(0, -1); }
    const sole = matches.length === 1;
    const fill = common + (sole && !common.endsWith('/') ? ' ' : '');
    if (fill.length > word.length) {
      el.value = before.slice(0, start) + fill + after;
      const n = start + fill.length;
      el.setSelectionRange(n, n);
      return;
    }
    // nothing more to fill: a second Tab lists the options
    if (this.lastTab === before) {
      this.echo(el.value);
      this.print(matches.join('  '), 'ls');
    }
    this.lastTab = before;
  }
}
