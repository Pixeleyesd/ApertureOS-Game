// real versions of systemctl and journalctl (chapter 3 unlocks them).
// glados is the only service the story cares about. the others exist so the commands feel like the real thing when you poke around.

import { ShellError } from '../shell.js';
import { clock, fmtDate, setFlag } from '../state.js';

const UP_SINCE = 'Mon 2010-08-02 07:12:44 UTC; 9 months ago';

const SERVICES = {
  glados: { desc: 'Central System (Enrichment Center)', pid: 301, log: '/var/log/glados.log' },
  cron: { desc: 'Scheduled job runner', pid: 118 },
  'hvac-control': { desc: 'Ventilation and temperature control', pid: 131, key: 'hvac' },
  'lighting-l2': { desc: 'Corridor lighting, level 2', pid: 144, key: 'corridor L2' },
  'sensor-net': { desc: 'Facility sensor network', pid: 152, key: 'sensor' },
};

const unitName = (u) => String(u || '').replace(/\.service$/, '');

function gladosState(s) {
  if (!s.flags.glados_started) return 'inactive';
  return s.flags.glados_ready ? 'active' : 'activating';
}

function ago(secs) {
  secs = Math.max(0, Math.floor(secs));
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}min ${secs % 60}s`;
}

function status(ctx, name) {
  const s = ctx.state;
  const svc = SERVICES[name];
  if (!svc) throw new ShellError(`Unit ${name}.service could not be found.\n(Try  systemctl list-units  to see what is here.)`);
  const head = `● ${name}.service - ${svc.desc}`;
  if (name !== 'glados') {
    return `${head}\n     Loaded: loaded (/etc/systemd/system/${name}.service; enabled)\n     Active: active (running) since ${UP_SINCE}\n   Main PID: ${svc.pid} (${name})`;
  }
  const st = gladosState(s);
  const loaded = `     Loaded: loaded (/etc/systemd/system/glados.service; disabled)`;
  if (st === 'inactive') {
    return `${head}\n${loaded}\n     Active: inactive (dead)\n\nIt is asleep. The runbook says how to wake it (step 5, a Tier 3 step covered by ticket 4417).`;
  }
  const since = fmtDate(clock({ t: s.flagAt.glados_started, skew: s.skew }));
  const took = ago(s.t - s.flagAt.glados_started);
  const lines = ctx.fs.read('/var/log/glados.log').split('\n').filter(Boolean).slice(-3).map((l) => '             ' + l);
  const active = st === 'activating'
    ? `     Active: activating (start) since ${since}; ${took} ago`
    : `     Active: active (running) since ${since}; ${took} ago`;
  return [head, loaded, active, `   Main PID: ${svc.pid} (glados)`, '', ...lines].join('\n');
}

export default [
  {
    name: 'systemctl', locked: true, summary: 'start, stop and check services',
    usage: 'systemctl <status | start | stop | restart | list-units> [service]',
    desc: 'Services are the programs the facility runs in the background. "status" tells you whether one is running. "start" turns one on. Your badge only covers the steps your ticket names, so stop and restart are not available to you. "list-units" shows every service.',
    examples: ['systemctl list-units', 'systemctl status glados', 'systemctl start glados'], see: ['journalctl', 'ps'],
    lockedMsg: 'systemctl: Tier 3 only. Your badge is Tier 2. If your ticket needs it, the runbook will say so.',
    run(args, ctx) {
      const words = args.filter((a) => !a.startsWith('-'));
      const verb = words[0] || 'list-units';
      const s = ctx.state;
      if (verb === 'list-units') {
        const st = (n) => (n === 'glados' ? gladosState(s) : 'active');
        const rows = Object.keys(SERVICES).map((n) => `  ${(n + '.service').padEnd(22)}${st(n).padEnd(12)}${SERVICES[n].desc}`);
        return ['  UNIT                  ACTIVE      DESCRIPTION', ...rows, '', `${rows.length} units listed. Look closer with:  systemctl status <name>`].join('\n');
      }
      const name = unitName(words[1]);
      if (!words[1]) throw new ShellError(`systemctl: ${verb} which service? For example:  systemctl ${verb} glados`);
      if (verb === 'status') return status(ctx, name);
      if (!SERVICES[name]) throw new ShellError(`Failed to ${verb} ${name}.service: Unit ${name}.service not found.`);
      if (verb === 'start') {
        if (name !== 'glados') return `${name}.service is already running.`;
        if (s.flags.glados_started) return s.flags.glados_ready ? 'glados.service is already running.' : 'glados.service is already starting. Give it a moment.';
        setFlag(s, 'glados_started', true);
        return [
          'Authenticated: ticket 4417 covers this Tier 3 step.',
          'Starting glados.service ...',
          'Start requested. Booting takes about half a minute.',
          '',
          'Watch it come up with:   tail -f /var/log/glados.log      (Ctrl+C to stop watching)',
        ].join('\n');
      }
      if (['stop', 'restart', 'enable', 'disable', 'kill'].includes(verb)) {
        throw new ShellError(`Failed to ${verb} ${name}.service: Interactive authentication required.\n(Tier 3 only. Ticket 4417 covers starting the central system, not changing it. Ask Dr. Brandt.)`);
      }
      throw new ShellError(`systemctl: I don't know "${verb}". Try:  systemctl status glados   systemctl list-units`);
    },
  },

  {
    name: 'journalctl', locked: true, summary: 'read the system journal',
    usage: 'journalctl [-u service] [-n lines] [-f]',
    desc: 'The journal is the facility\'s combined log. With no options it shows the facility log. -u picks one service, -n limits how many of the newest lines to show, and -f keeps watching for new lines until you press Ctrl+C.',
    examples: ['journalctl', 'journalctl -u glados', 'journalctl -u glados -n 5', 'journalctl -u glados -f'], see: ['tail', 'systemctl'],
    lockedMsg: 'journalctl: Tier 3 only for now. The plain logs in /var/log are open to you.',
    run(args, ctx) {
      let unit = null, n = 40, follow = false;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-u') unit = unitName(args[++i]);
        else if (a === '-n') n = parseInt(args[++i], 10);
        else if (a === '-f') follow = true;
        else if (a.startsWith('-')) continue;
        else throw new ShellError(`journalctl: I don't know "${a}". Try:  journalctl -u glados`);
      }
      if (!Number.isFinite(n) || n < 1) throw new ShellError('journalctl: -n needs a number, like  -n 5');
      let path = '/var/log/facility.log';
      let filter = null;
      if (unit) {
        const svc = SERVICES[unit];
        if (!svc && unit !== 'corectl') throw new ShellError(`journalctl: no unit called ${unit}. Try  systemctl list-units`);
        if (svc && svc.log) path = svc.log; else if (unit === 'corectl') path = '/var/log/corectl.log'; else filter = svc.key || unit;
      }
      const mark = (ctx.state.chapterRead = ctx.state.chapterRead || []);
      if (!mark.includes(path)) mark.push(path);
      if (!ctx.state.read.includes(path)) ctx.state.read.push(path);
      let lines = ctx.fs.read(path).split('\n').filter(Boolean);
      if (filter) lines = lines.filter((l) => l.includes(filter));
      const out = lines.length ? lines.slice(-n).join('\n') : '-- No entries --';
      if (!follow) return out;
      ctx.w.startFollow(path);
      return out + '\n(watching for new lines. Press Ctrl+C to stop.)';
    },
  },
];
