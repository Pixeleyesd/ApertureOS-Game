// the fake filesystem. a plain tree in memory.

const dir = () => ({ type: 'dir', children: {}, locked: false, mtime: 'May 17 09:12' });
const file = (content = '') => ({ type: 'file', content, dynamic: null, locked: false, mtime: 'May 17 09:12' });

export class FS {
  constructor(home = '/home/drattman') {
    this.root = dir();
    this.home = home;
    this.onWrite = null; // (abs, content) => void, used for saving
  }

  resolve(base, p) {
    if (p === undefined || p === null || p === '') return base;
    if (p === '~' || p.startsWith('~/')) p = this.home + p.slice(1);
    const parts = (p.startsWith('/') ? p : base + '/' + p).split('/');
    const out = [];
    for (const s of parts) {
      if (!s || s === '.') continue;
      if (s === '..') out.pop(); else out.push(s);
    }
    return '/' + out.join('/');
  }

  get(abs) {
    let n = this.root;
    for (const s of abs.split('/').filter(Boolean)) {
      if (!n || n.type !== 'dir') return null;
      n = n.children[s];
    }
    return n || null;
  }

  isDir(abs) { const n = this.get(abs); return !!n && n.type === 'dir'; }
  exists(abs) { return !!this.get(abs); }

  // first locked folder on the way to abs (including abs itself), or null
  lockedAt(abs) {
    let n = this.root, path = '';
    for (const s of abs.split('/').filter(Boolean)) {
      if (!n || n.type !== 'dir') return null;
      n = n.children[s];
      path += '/' + s;
      if (n && n.locked) return path;
    }
    return null;
  }

  mkdirp(abs) {
    let n = this.root;
    for (const s of abs.split('/').filter(Boolean)) {
      if (!n.children[s]) n.children[s] = dir();
      n = n.children[s];
    }
    return n;
  }

  // used when building the disk; no save hook
  put(abs, content, extra = {}) {
    const parts = abs.split('/').filter(Boolean);
    const name = parts.pop();
    const parent = this.mkdirp('/' + parts.join('/'));
    const f = file(content);
    Object.assign(f, extra);
    parent.children[name] = f;
    return f;
  }

  // used by commands and the story; this is what gets saved
  write(abs, content, append = false) {
    const parts = abs.split('/').filter(Boolean);
    const name = parts.pop();
    const parent = this.get('/' + parts.join('/'));
    if (!parent || parent.type !== 'dir') throw new Error('No such file or directory');
    const cur = parent.children[name];
    if (cur && cur.type === 'dir') throw new Error('Is a directory');
    const text = append && cur ? this.read(abs) + content : content;
    if (cur) { cur.content = text; cur.dynamic = null; }
    else parent.children[name] = file(text);
    if (this.onWrite) this.onWrite(abs, text);
  }

  read(abs) {
    const n = this.get(abs);
    if (!n || n.type !== 'file') return '';
    return n.dynamic ? n.dynamic() : n.content;
  }

  list(abs) {
    const n = this.get(abs);
    if (!n || n.type !== 'dir') return [];
    return Object.keys(n.children).sort((a, b) => a.localeCompare(b));
  }

  size(abs) {
    const n = this.get(abs);
    if (!n) return 0;
    return n.type === 'dir' ? 4096 : this.read(abs).length;
  }

  // every file under abs (for grep -r and find)
  walk(abs, cb) {
    for (const name of this.list(abs)) {
      const p = (abs === '/' ? '' : abs) + '/' + name;
      const n = this.get(p);
      if (n.locked) continue;
      cb(p, n);
      if (n.type === 'dir') this.walk(p, cb);
    }
  }
}
