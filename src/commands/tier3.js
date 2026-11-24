// chapter 11: the old Tier 3 account, and what it can and cannot do.
// login, rm and shutdown are blocked by central in different ways, mount opens
// the central drive, and queue edits the list on it.

import { ShellError } from '../shell.js';
import { setFlag } from '../state.js';

const LIST = '/mnt/glados/subjects.list';
const lineRe = /^(\d{4})  (.*)$/;

const login = {
  name: 'login', summary: 'log in as another account',
  usage: 'login <account> <password>',
  desc: 'Switches to another account on this terminal. Give the account name and its password.',
  examples: ['login cjohnson <password>'], see: ['whoami'],
  run(args, ctx) {
    const s = ctx.state;
    const [who, pass] = args.filter((a) => !a.startsWith('-'));
    if (!who) throw new ShellError('login: which account? For example:  login <account> <password>');
    if (who === 'drattman') return 'login: you are already drattman.';
    if (who !== 'cjohnson' || pass !== 'tier3') throw new ShellError('Login incorrect.');
    if (s.flags.tier3) return 'login: you are already cjohnson.';
    setFlag(s, 'tier3', true);
    s.prompt = 'cjohnson@{host}:{cwd}# ';
    return [
      'Last login: Fri Sep 30 17:44:02 1983 on console',
      '',
      'Welcome, C. Johnson. Tier 3 (legacy account, no expiry).',
      'This account predates the central system.',
    ].join('\n');
  },
};

const BLOCK = (what) => `${what}: Operation not permitted.\n(protected by central. It says it is sorry, and that it asked nicely.)`;

const rm = {
  name: 'rm', summary: 'delete files', hidden: true,
  usage: 'rm [-rf] <path>', desc: 'Deletes files. Tier 3 only.', examples: [], see: [],
  run(args, ctx) {
    const s = ctx.state;
    if (!s.flags.tier3) throw new ShellError('rm: file deletion needs a Tier 3 badge (Maintenance Policy 4-B). Nothing here needs deleting tonight.');
    const paths = args.filter((a) => !a.startsWith('-'));
    if (!paths.length) throw new ShellError('rm: delete what? For example:  rm -rf <path>');
    const flat = args.join(' ');
    const root = paths.some((p) => p === '/' || p === '/*' || p === '/.') || /--no-preserve-root/.test(flat);
    const hers = paths.some((p) => /glados/i.test(p) || /\/opt\/aperture(\/|$)/.test(p));
    if (root) {
      setFlag(s, 'tried_root', true);
      throw new ShellError('rm: it is dangerous to operate recursively on "/"\nrm: central has refused. The root is where she lives, and she would rather you did not.\n' + BLOCK('rm: cannot remove "/"'));
    }
    if (hers) {
      setFlag(s, 'tried_wipe', true);
      throw new ShellError(BLOCK(`rm: cannot remove '${paths[0]}'`));
    }
    throw new ShellError(BLOCK(`rm: cannot remove '${paths[0]}'`));
  },
};

const shutdown = (name) => ({
  name, summary: 'power the system down', hidden: true,
  usage: name, desc: 'Powers the system down. Tier 3 only.', examples: [], see: [],
  run(args, ctx) {
    const s = ctx.state;
    if (!s.flags.tier3) throw new ShellError(`${name}: Tier 3 only.`);
    setFlag(s, 'tried_stop', true);
    throw new ShellError(`${name}: central has declined. She has protected herself from this account.\n(It is, she says, one of the first things she did.)`);
  },
});

const mount = {
  name: 'mount', summary: 'attach a drive', hidden: true,
  usage: 'mount <device> <folder>', desc: 'Attaches a drive to a folder. Tier 3 only.', examples: ['mount /dev/gld0 /mnt/glados'], see: ['ls'],
  run(args, ctx) {
    const s = ctx.state, fs = ctx.fs;
    if (!s.flags.tier3) throw new ShellError('mount: only a Tier 3 account can attach drives.');
    const [dev, dir] = args.filter((a) => !a.startsWith('-'));
    if (!dev) return s.flags.mounted
      ? '/dev/gld0 on /mnt/glados type central (rw)'
      : 'Not mounted:  /dev/gld0   central drive (GLaDOS)\nMount it with:  mount /dev/gld0 /mnt/glados';
    if (dev !== '/dev/gld0') throw new ShellError(`mount: ${dev}: no such device. The central drive is /dev/gld0.`);
    if (dir !== '/mnt/glados') throw new ShellError('mount: the central drive mounts on /mnt/glados.');
    if (s.flags.mounted) return 'mount: /dev/gld0 is already mounted on /mnt/glados.';
    const src = fs.read('/srv/enrichment/queue.txt');
    const body = src.split('\n').filter((l) => lineRe.test(l)).join('\n');
    fs.write(LIST, [
      '# subjects.list: central drive. this is the order she reads, top first.',
      '# edited with  queue move <from> <to>',
      '',
      body,
      '',
    ].join('\n'));
    fs.write('/mnt/glados/README.txt', 'GLaDOS drive. c. johnson, 1983.\nsubjects.list is the real order. the copy in /srv/enrichment is for show.\nthe central system reads the top entry first.\n');
    setFlag(s, 'mounted', true);
    return [
      'mount: /dev/gld0 attached on /mnt/glados',
      '',
      '/mnt/glados:  README.txt  subjects.list',
      'Take a look with:  ls /mnt/glados   cat /mnt/glados/README.txt',
    ].join('\n');
  },
};

function readList(ctx) {
  const rows = ctx.fs.read(LIST).split('\n').filter((l) => lineRe.test(l));
  return rows.map((l) => { const m = l.match(lineRe); return m[2]; });
}
function writeList(ctx, entries) {
  const head = ['# subjects.list: central drive. this is the order she reads, top first.', '# edited with  queue move <from> <to>', ''];
  const body = entries.map((e, i) => String(i + 1).padStart(4, '0') + '  ' + e);
  ctx.fs.write(LIST, [...head, ...body, ''].join('\n'));
}

const queue = {
  name: 'queue', summary: 'read or reorder the subject list on the central drive', hidden: true,
  usage: 'queue <show N | head | move FROM TO>',
  desc: 'Works on /mnt/glados/subjects.list. "head" shows the first ten. "show 1498" shows one entry. "move 1498 1" puts entry 1498 at number 1 and renumbers everything below it.',
  examples: ['queue head', 'queue show 1498', 'queue move 1498 1'], see: ['mount'],
  run(args, ctx) {
    const s = ctx.state;
    if (!s.flags.tier3) throw new ShellError('queue: Tier 3 only.');
    if (!s.flags.mounted) throw new ShellError('queue: nothing to work on. The central drive is not mounted yet (mount /dev/gld0 /mnt/glados).');
    const w = args.filter((a) => !a.startsWith('-'));
    const verb = w[0] || 'head';
    const entries = readList(ctx);
    const num = (x) => { const n = parseInt(x, 10); return Number.isFinite(n) ? n : NaN; };
    if (verb === 'head') return entries.slice(0, 10).map((e, i) => String(i + 1).padStart(4, '0') + '  ' + e).join('\n');
    if (verb === 'show') {
      const n = num(w[1]);
      if (!(n >= 1 && n <= entries.length)) throw new ShellError(`queue: show which entry? A number from 1 to ${entries.length}.`);
      return String(n).padStart(4, '0') + '  ' + entries[n - 1];
    }
    if (verb === 'move') {
      const from = num(w[1]), to = num(w[2]);
      if (!(from >= 1 && from <= entries.length) || !(to >= 1 && to <= entries.length)) throw new ShellError(`queue: move needs two numbers from 1 to ${entries.length}. For example:  queue move 1498 1`);
      if (from === to) return 'queue: that is already where it is.';
      const [item] = entries.splice(from - 1, 1);
      entries.splice(to - 1, 0, item);
      writeList(ctx, entries);
      setFlag(s, 'queue_moved', true);
      if (to === 1 && /TENACITY ABNORMAL/.test(item)) setFlag(s, 'chell_first', true);
      return [
        `moved entry ${String(from).padStart(4, '0')} to ${String(to).padStart(4, '0')}.`,
        'now:  ' + String(to).padStart(4, '0') + '  ' + item,
        'Everything between has moved down one place.',
      ].join('\n');
    }
    throw new ShellError('queue: try  queue head   queue show 1498   queue move 1498 1');
  },
};

export default [login, rm, shutdown('shutdown'), shutdown('poweroff'), shutdown('halt'), mount, queue];
