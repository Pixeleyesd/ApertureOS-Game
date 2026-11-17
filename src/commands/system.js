// system-ish commands: clear history whoami hostname date uptime who ps sudo exit newgame

import { clock, fmtClock, fmtDate, fmtShort, USER, HOST } from '../state.js';

export default [
  { name: 'clear', summary: 'wipe the screen', usage: 'clear', desc: 'Clears the screen. Ctrl+L does the same. Nothing is deleted, your progress is safe.', examples: ['clear'], see: [], run(a, ctx) { ctx.w.clear(); } },

  {
    name: 'history', summary: 'list the commands you have typed',
    usage: 'history', desc: 'Shows every command you have run, numbered. Press the up arrow to bring back the last one.', examples: ['history'], see: [],
    run(a, ctx) { return ctx.state.ran.map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join('\n'); },
  },

  { name: 'whoami', summary: 'show who you are logged in as', usage: 'whoami', desc: 'Prints your login name.', examples: ['whoami'], see: ['who'], run: () => USER },
  { name: 'hostname', summary: 'show this terminal\'s name', usage: 'hostname', desc: 'Prints the name of the machine you are on.', examples: ['hostname'], see: [], run: () => HOST },
  { name: 'date', summary: 'show the date and time', usage: 'date', desc: 'Prints the current facility date and time.', examples: ['date'], see: ['uptime'], run: (a, ctx) => fmtDate(clock(ctx.state)) },

  {
    name: 'uptime', summary: 'how long this machine has been up',
    usage: 'uptime', desc: 'Shows the time, how long the terminal has been running, and how busy it is.', examples: ['uptime'], see: ['date'],
    run(a, ctx) {
      const m = Math.floor(ctx.state.t / 60) % 60;
      return ` ${fmtClock(clock(ctx.state))} up 214 days,  3:${String(m).padStart(2, '0')},  1 user,  load average: 0.02, 0.01, 0.00`;
    },
  },

  {
    name: 'who', summary: 'see who is on shift',
    usage: 'who', desc: 'Lists everyone currently logged in to the facility. Keep an eye on it.', examples: ['who'], see: ['whoami', 'ps'],
    run(a, ctx) {
      const people = ctx.w.characters.filter((p) => !ctx.state.gone[p.login]);
      const since = fmtShort(clock({ t: 0 }));
      return people.map((p) => `${p.login.padEnd(10)} ${String(p.tty).padEnd(8)} ${p.login === USER ? since : p.since}  (${p.role})`).join('\n');
    },
  },

  {
    name: 'ps', summary: 'list running programs',
    usage: 'ps', desc: 'Shows the programs running on this terminal.', examples: ['ps'], see: ['who'],
    run(a, ctx) {
      const rows = ['  PID TTY          TIME CMD', '    1 ?        00:00:03 init', '  118 ?        00:00:00 cron', '  240 tty1     00:00:00 bash'];
      if (ctx.state.flags.glados_awake) rows.push('  301 ?        00:00:41 glados');
      rows.push('  412 tty1     00:00:00 ps');
      return rows.join('\n');
    },
  },

  {
    name: 'sudo', summary: 'run something as an administrator',
    usage: 'sudo <command>', desc: 'Not available to Tier 2 accounts.', examples: [], see: [],
    run() { return `${USER} is not in the sudoers file. This incident will be reported.\n(Only joking about the report. Tier 3 steps need Dr. Brandt's sign-off.)`; },
  },

  {
    name: 'exit', aliases: ['logout'], summary: 'log out (not yet)',
    usage: 'exit', desc: 'Your shift is not over. Type newgame yes if you want to wipe your save and start again.', examples: [], see: ['newgame'],
    run() { return 'logout: your shift is not over yet. Type "help" if you are not sure what to do next.\n(To wipe your save and start from the top: newgame)'; },
  },

  {
    name: 'newgame', summary: 'wipe your save and start from the top',
    usage: 'newgame yes', desc: 'Erases your progress and begins again from the first login. It asks you to type "yes" so you do not do it by accident.', examples: ['newgame yes'], see: [],
    run(args, ctx) {
      if (args[0] !== 'yes') return 'This wipes your save and starts the shift over.\nIf you are sure, type:  newgame yes';
      ctx.w.reset();
    },
  },
];
