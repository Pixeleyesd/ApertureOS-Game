// file and text commands: ls cd pwd cat less head tail grep find tree echo wc

import { ShellError } from '../shell.js';

const missing = (cmd, p) => new ShellError(`${cmd}: ${p}: No such file or directory\n(Type "ls" to see what is in this folder.)`);
const denied = (cmd, p) => new ShellError(`${cmd}: ${p}: Permission denied\n(That area is above your clearance for now.)`);

function readFile(ctx, cmd, p) {
  const abs = ctx.abs(p);
  const n = ctx.fs.get(abs);
  if (!n) throw missing(cmd, p);
  if (ctx.fs.lockedAt(abs)) throw denied(cmd, p);
  if (n.type === 'dir') throw new ShellError(`${cmd}: ${p}: Is a directory\n(Use "ls ${p}" to see what is inside it.)`);
  if (!ctx.state.read.includes(abs)) ctx.state.read.push(abs);
  return ctx.fs.read(abs);
}

const linesOf = (t) => { const l = String(t).split('\n'); if (l[l.length - 1] === '') l.pop(); return l; };

function columns(names, width) {
  if (!names.length) return '';
  const w = Math.max(...names.map((n) => n.length)) + 2;
  const per = Math.max(1, Math.floor(width / w));
  const rows = Math.ceil(names.length / per);
  const out = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < per; c++) {
      const n = names[c * rows + r];
      if (n !== undefined) line += n.padEnd(w);
    }
    out.push(line.trimEnd());
  }
  return out.join('\n');
}

function parseCount(args, def = 10) {
  let n = def; const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n') { n = parseInt(args[++i], 10); }
    else if (/^-n\d+$/.test(a)) n = parseInt(a.slice(2), 10);
    else if (/^-\d+$/.test(a)) n = parseInt(a.slice(1), 10);
    else rest.push(a);
  }
  if (!Number.isFinite(n) || n < 0) throw new ShellError('that needs a number of lines, like:  head -n 5 file');
  return { n, rest };
}

export default [
  {
    name: 'ls', summary: 'see what is in a folder',
    usage: 'ls [-l] [-a] [folder or file]',
    desc: 'Lists the files and folders where you are, or in the one you name. Folders end with a / so you can tell them apart. -l shows details (size, date). -a also shows hidden files, the ones that start with a dot.',
    examples: ['ls', 'ls -l', 'ls -a', 'ls tickets'], see: ['cd', 'cat', 'tree'],
    run(args, ctx) {
      let long = false, all = false;
      const paths = [];
      for (const a of args) {
        if (a.startsWith('-') && a.length > 1) {
          for (const ch of a.slice(1)) {
            if (ch === 'l') long = true; else if (ch === 'a') all = true; else if (ch !== '1') throw new ShellError(`ls: I don't know the option -${ch}. Try:  ls   ls -l   ls -a`);
          }
        } else paths.push(a);
      }
      if (!paths.length) paths.push('.');
      const blocks = [];
      for (const p of paths) {
        const abs = ctx.abs(p);
        const n = ctx.fs.get(abs);
        if (!n) { blocks.push(missing('ls', p).message); continue; }
        if (ctx.fs.lockedAt(abs)) { blocks.push(`ls: cannot open directory '${p}': Permission denied\n(That area is above your clearance for now.)`); continue; }
        const owner = (q) => (q === ctx.fs.home || q.startsWith(ctx.fs.home + '/') ? 'drattman' : 'root');
        const row = (name, q, node) => {
          const d = node.type === 'dir';
          return `${d ? 'd' : '-'}${d ? 'rwxr-xr-x' : 'rw-r--r--'} 1 ${owner(q).padEnd(8)} staff ${String(ctx.fs.size(q)).padStart(6)} ${node.mtime} ${name}`;
        };
        let text;
        if (n.type === 'file') text = long ? row(p, abs, n) : p;
        else {
          let names = ctx.fs.list(abs).filter((x) => all || !x.startsWith('.'));
          if (all) names = ['.', '..', ...names];
          const full = (x) => (x === '.' ? abs : x === '..' ? ctx.fs.resolve(abs, '..') : (abs === '/' ? '' : abs) + '/' + x);
          if (long) text = `total ${names.length * 4}\n` + names.map((x) => row(x, full(x), ctx.fs.get(full(x)))).join('\n');
          else text = columns(names.map((x) => (ctx.fs.isDir(full(x)) ? x + '/' : x)), ctx.cols);
        }
        blocks.push(paths.length > 1 && n.type === 'dir' ? `${p}:\n${text}` : text);
      }
      return blocks.join('\n\n');
    },
  },

  {
    name: 'cd', summary: 'move into another folder',
    usage: 'cd [folder]',
    desc: 'Changes the folder you are working in. "cd" on its own takes you home. "cd .." goes up one level. "cd -" goes back to where you just were. Your prompt always shows where you are.',
    examples: ['cd tickets', 'cd ..', 'cd ~', 'cd /var/log'], see: ['ls', 'pwd'],
    run(args, ctx) {
      const s = ctx.state;
      let target = args[0];
      if (target === '-') target = s.oldcwd;
      const abs = target === undefined ? ctx.fs.home : ctx.abs(target);
      const n = ctx.fs.get(abs);
      if (!n) throw missing('cd', target);
      if (n.type !== 'dir') throw new ShellError(`cd: ${target}: Not a directory\n(Use "cat ${target}" to read a file.)`);
      if (ctx.fs.lockedAt(abs)) throw denied('cd', target);
      s.oldcwd = s.cwd; s.cwd = abs;
      if (!s.visited.includes(abs)) s.visited.push(abs);
    },
  },

  { name: 'pwd', summary: 'show exactly where you are', usage: 'pwd', desc: 'Prints the full path of the folder you are in.', examples: ['pwd'], see: ['cd', 'ls'], run: (a, ctx) => ctx.state.cwd },

  {
    name: 'cat', summary: 'read a file',
    usage: 'cat <file> [more files]',
    desc: 'Prints what is inside a file. Give it more than one file and it prints them one after another.',
    examples: ['cat HANDOFF.txt', 'cat tickets/4417.txt'], see: ['less', 'head', 'tail', 'grep'],
    run(args, ctx) {
      if (!args.length) return ctx.stdin !== undefined && ctx.stdin !== '' ? ctx.stdin : undefined;
      return args.map((p) => readFile(ctx, 'cat', p).replace(/\n$/, '')).join('\n');
    },
  },

  {
    name: 'less', aliases: ['more'], summary: 'read a longer file',
    usage: 'less <file>',
    desc: 'Like cat, for long files. On this terminal it prints the whole file and you scroll with your mouse or the page keys.',
    examples: ['less /var/log/facility.log'], see: ['cat', 'head', 'tail'],
    run(args, ctx) {
      if (!args.length) throw new ShellError('less: which file? For example:  less /var/log/facility.log');
      return readFile(ctx, 'less', args[0]).replace(/\n$/, '') + '\n(END)';
    },
  },

  {
    name: 'head', summary: 'see the start of a file',
    usage: 'head [-n lines] <file>',
    desc: 'Prints the first 10 lines of a file, or the number you ask for with -n.',
    examples: ['head HANDOFF.txt', 'head -n 3 /var/log/facility.log'], see: ['tail', 'cat'],
    run(args, ctx) {
      const { n, rest } = parseCount(args);
      const text = rest.length ? readFile(ctx, 'head', rest[0]) : ctx.stdin || '';
      return linesOf(text).slice(0, n).join('\n');
    },
  },

  {
    name: 'tail', summary: 'see the end of a file (newest log lines)',
    usage: 'tail [-n lines] <file>',
    desc: 'Prints the last 10 lines of a file, or the number you ask for. Logs grow at the bottom, so tail shows the newest. The -f option is accepted, but this terminal cannot follow a file live: run tail again to see new lines.',
    examples: ['tail /var/log/facility.log', 'tail -n 3 /var/log/glados.log'], see: ['head', 'cat'],
    run(args, ctx) {
      const follow = args.includes('-f');
      const { n, rest } = parseCount(args.filter((a) => a !== '-f'));
      const text = rest.length ? readFile(ctx, 'tail', rest[0]) : ctx.stdin || '';
      const l = linesOf(text);
      const out = (n === 0 ? [] : l.slice(-n)).join('\n');
      return follow ? out + '\n(-f cannot follow live on this terminal. Run tail again to see new lines.)' : out;
    },
  },

  {
    name: 'grep', summary: 'search for words inside files',
    usage: 'grep [-i] [-n] [-v] [-c] [-r] <word> [files or folder]',
    desc: 'Prints the lines that contain a word. -i ignores capital letters, -n shows line numbers, -v shows the lines that do NOT match, -c just counts them, -r searches every file inside a folder. You can also pipe into it:  cat file | grep word',
    examples: ['grep glados /var/log/facility.log', 'grep -ri brandt /var/log', 'cat HANDOFF.txt | grep ticket'], see: ['find', 'cat'],
    run(args, ctx) {
      const f = { i: false, n: false, v: false, c: false, r: false };
      const rest = [];
      for (const a of args) {
        if (/^-[a-zA-Z]+$/.test(a)) for (const ch of a.slice(1).toLowerCase()) { if (ch in f) f[ch] = true; else throw new ShellError(`grep: I don't know the option -${ch}. Try -i -n -v -c -r`); }
        else rest.push(a);
      }
      if (!rest.length) throw new ShellError('grep: what are you looking for? For example:  grep glados /var/log/facility.log');
      const pat = rest.shift();
      let re;
      try { re = new RegExp(pat, f.i ? 'i' : ''); } catch { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), f.i ? 'i' : ''); }
      const sources = [];
      if (!rest.length) {
        if (f.r) rest.push('.'); else sources.push({ name: '', text: ctx.stdin || '' });
      }
      for (const p of rest) {
        const abs = ctx.abs(p);
        const node = ctx.fs.get(abs);
        if (!node) throw missing('grep', p);
        if (ctx.fs.lockedAt(abs)) throw denied('grep', p);
        if (node.type === 'dir') {
          if (!f.r) throw new ShellError(`grep: ${p}: Is a directory\n(Add -r to search inside a folder:  grep -r ${pat} ${p})`);
          ctx.fs.walk(abs, (q, nd) => { if (nd.type === 'file') sources.push({ name: p === '.' ? q.slice(ctx.state.cwd.length + 1) || q : p.replace(/\/$/, '') + q.slice(abs.length), text: ctx.fs.read(q) }); });
        } else sources.push({ name: p, text: readFile(ctx, 'grep', p) });
      }
      const label = sources.length > 1 || f.r;
      const out = [];
      for (const src of sources) {
        let count = 0;
        linesOf(src.text).forEach((line, k) => {
          if (re.test(line) !== f.v) {
            count++;
            if (!f.c) out.push(`${label && src.name ? src.name + ':' : ''}${f.n ? (k + 1) + ':' : ''}${line}`);
          }
        });
        if (f.c) out.push(`${label && src.name ? src.name + ':' : ''}${count}`);
      }
      return out.length ? out.join('\n') : undefined;
    },
  },

  {
    name: 'find', summary: 'look for files by name',
    usage: 'find [folder] [-name pattern] [-type f|d]',
    desc: 'Walks through a folder and everything inside it, printing the paths that match. Patterns can use * as a wildcard.',
    examples: ['find / -name "*.log"', 'find ~ -type f'], see: ['grep', 'ls', 'tree'],
    run(args, ctx) {
      let start = '.', pat = null, type = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-name') pat = args[++i];
        else if (args[i] === '-type') type = args[++i];
        else if (!args[i].startsWith('-')) start = args[i];
        else throw new ShellError(`find: I only know -name and -type. Example:  find / -name "*.log"`);
      }
      const abs = ctx.abs(start);
      const root = ctx.fs.get(abs);
      if (!root) throw missing('find', start);
      if (ctx.fs.lockedAt(abs)) throw denied('find', start);
      const re = pat ? new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$') : null;
      const typed = start.replace(/\/$/, '') || (start === '/' ? '' : start);
      const out = [];
      const consider = (p, n, shown) => {
        const base = p.split('/').pop() || '/';
        if (re && !re.test(base)) return;
        if (type === 'f' && n.type !== 'file') return;
        if (type === 'd' && n.type !== 'dir') return;
        out.push(shown);
      };
      consider(abs, root, start);
      ctx.fs.walk(abs, (p, n) => consider(p, n, typed + p.slice(abs === '/' ? 0 : abs.length)));
      return out.length ? out.join('\n') : undefined;
    },
  },

  {
    name: 'tree', summary: 'draw a map of a folder and what is inside',
    usage: 'tree [folder]',
    desc: 'Shows a folder and everything inside it as an indented map. Great when you are lost and want the big picture. Hidden files are left out.',
    examples: ['tree', 'tree /opt'], see: ['ls', 'find'],
    run(args, ctx) {
      const start = args[0] || '.';
      const abs = ctx.abs(start);
      const root = ctx.fs.get(abs);
      if (!root) throw missing('tree', start);
      if (ctx.fs.lockedAt(abs)) throw denied('tree', start);
      let dirs = 0, files = 0;
      const out = [start === '.' ? '.' : start];
      const go = (p, prefix, depth) => {
        const names = ctx.fs.list(p).filter((n) => !n.startsWith('.'));
        names.forEach((name, i) => {
          const q = (p === '/' ? '' : p) + '/' + name;
          const n = ctx.fs.get(q);
          const last = i === names.length - 1;
          const isDir = n.type === 'dir';
          out.push(`${prefix}${last ? '└── ' : '├── '}${name}${isDir ? '/' : ''}${n.locked ? '  (locked)' : ''}`);
          if (isDir) { dirs++; if (!n.locked && depth < 5) go(q, prefix + (last ? '    ' : '│   '), depth + 1); } else files++;
        });
      };
      if (root.type === 'dir') go(abs, '', 1);
      out.push('', `${dirs} folder${dirs === 1 ? '' : 's'}, ${files} file${files === 1 ? '' : 's'}`);
      return out.join('\n');
    },
  },

  {
    name: 'echo', summary: 'print some text (or save it to a file)',
    usage: 'echo [-n] <text>',
    desc: 'Prints whatever you type after it. Combine it with > to save a note into a file in your home folder:  echo "remember to check the logs" > notes.txt   (use >> to add to the end instead of replacing).',
    examples: ['echo hello', 'echo "my note" > notes.txt', 'echo "another line" >> notes.txt'], see: ['cat'],
    run(args) { const n = args[0] === '-n'; const t = (n ? args.slice(1) : args).join(' '); return t; },
  },

  {
    name: 'wc', summary: 'count lines, words and characters',
    usage: 'wc [-l] [-w] [-c] [file]',
    desc: 'Counts lines, words and characters in a file or in piped text.',
    examples: ['wc HANDOFF.txt', 'ls | wc -l'], see: ['grep', 'cat'],
    run(args, ctx) {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const files = args.filter((a) => !a.startsWith('-'));
      const text = files.length ? readFile(ctx, 'wc', files[0]) : ctx.stdin || '';
      const l = (text.match(/\n/g) || []).length, w = text.split(/\s+/).filter(Boolean).length, c = text.length;
      const parts = [];
      if (!flags || flags.includes('l')) parts.push(l);
      if (!flags || flags.includes('w')) parts.push(w);
      if (!flags || flags.includes('c')) parts.push(c);
      return parts.join(' ') + (files[0] ? ' ' + files[0] : '');
    },
  },
];
