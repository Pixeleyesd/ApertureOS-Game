// the commands that keep players from getting lost: help hint man ticket mail beginner

import { ShellError } from '../shell.js';

function manPage(def) {
  const lines = [`NAME`, `    ${def.name} - ${def.summary}`, '', 'HOW TO USE IT', `    ${def.usage}`, '', 'WHAT IT DOES', ...wrap(def.desc, 70).map((l) => '    ' + l)];
  if (def.examples && def.examples.length) lines.push('', 'EXAMPLES', ...def.examples.map((e) => '    ' + e));
  if (def.see && def.see.length) lines.push('', 'SEE ALSO', '    ' + def.see.join(', '));
  return lines.join('\n');
}

function wrap(text, width) {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    if ((line + ' ' + w).trim().length > width) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}

function uniqueDefs(shell) {
  return [...new Set(shell.defs.values())].filter((d) => shell.available(d) && !d.hidden).sort((a, b) => a.name.localeCompare(b.name));
}

function contextHelp(ctx) {
  const { state, fs, shell, engine } = ctx;
  const ch = engine.chapter();
  const st = engine.nextStep();
  const lines = [`You are in: ${shell.cwdShown()}`];
  if (ch && ch.ticket) lines.push(`Ticket #${ch.ticket.number}: ${ch.ticket.title}`);
  if (st) lines.push(`Next step: ${st.text}`);
  lines.push('', 'Things you can try here:');
  const rows = [['ls', 'see what is in this folder']];
  const names = fs.list(state.cwd).filter((n) => !n.startsWith('.'));
  const path = (n) => (state.cwd === '/' ? '' : state.cwd) + '/' + n;
  const dirs = names.filter((n) => fs.isDir(path(n)) && !fs.lockedAt(path(n)));
  const files = names.filter((n) => !fs.isDir(path(n)));
  if (dirs[0]) rows.push([`cd ${dirs[0]}`, 'go into that folder']);
  files.slice(0, 2).forEach((f) => rows.push([`cat ${f}`, 'read that file']));
  if (state.cwd !== fs.home) rows.push(['cd ~', 'go back to your home folder']);
  if (state.mail.length) {
    const un = state.mail.filter((m) => !state.mailRead[m.id]).length;
    rows.push(['mail', un ? `you have ${un} unread message${un > 1 ? 's' : ''}` : 'check your inbox']);
  }
  if (ch && ch.ticket) rows.push(['ticket show', 'see your checklist']);
  rows.push(['hint', 'stuck? ask for a nudge']);
  const pad = Math.max(...rows.map((r) => r[0].length)) + 2;
  rows.forEach(([c, d]) => lines.push(`  ${c.padEnd(pad)}${d}`));
  lines.push('', 'Type "help all" for every command, or "man <command>" for details on one.');
  return lines.join('\n');
}

export default [
  {
    name: 'help', summary: 'what can I do right now?',
    usage: 'help [all | command]',
    desc: 'Looks at where you are and what your ticket needs next, then suggests things to type. "help all" lists every command you have. "help ls" explains one command.',
    examples: ['help', 'help all', 'help cat'], see: ['hint', 'man', 'ticket'],
    run(args, ctx) {
      if (!args.length) return contextHelp(ctx);
      if (args[0] === 'all') {
        const defs = uniqueDefs(ctx.shell);
        const pad = Math.max(...defs.map((d) => d.name.length)) + 2;
        return ['Everything you can use right now:', '', ...defs.map((d) => `  ${d.name.padEnd(pad)}${d.summary}`), '', 'Type "man <command>" for details on any of them.'].join('\n');
      }
      return ctx.shell.defs.get('man').run(args, ctx);
    },
  },

  {
    name: 'hint', summary: 'stuck? get a nudge',
    usage: 'hint',
    desc: 'Gives a hint for your current step. Ask again and the hint gets clearer. The last one tells you exactly what to type.',
    examples: ['hint'], see: ['help', 'ticket'],
    run(a, ctx) { return ctx.engine.hint(); },
  },

  {
    name: 'man', summary: 'read the manual for a command',
    usage: 'man <command>',
    desc: 'Explains one command in plain language, with examples you can copy.',
    examples: ['man ls', 'man grep'], see: ['help'],
    run(args, ctx) {
      if (!args.length) return 'Which command? For example:  man ls\nOr type "help" to see what to do next.';
      const def = ctx.shell.defs.get(args[0]);
      if (!def) return `No manual page for "${args[0]}".\nType "help all" to see the commands you have.`;
      if (!ctx.shell.available(def)) return `${def.name}: this one is above your clearance for now, so there is no manual page yet.`;
      return manPage(def);
    },
  },

  {
    name: 'ticket', summary: 'your checklist for this shift',
    usage: 'ticket [show | list | accept]',
    desc: 'Tickets are your assigned work. "ticket show" is a checklist that ticks itself off as you go and tells you the next thing to do. "ticket accept" takes the ticket once you have read what it says.',
    examples: ['ticket show', 'ticket list', 'ticket accept'], see: ['hint', 'help'],
    run(args, ctx) {
      const eng = ctx.engine, ch = eng.chapter(), s = ctx.state;
      const sub = args[0] || 'show';
      if (sub === 'list') {
        const closed = ctx.fs.list(ctx.fs.home + '/tickets/closed');
        const open = ch && ch.ticket ? `  OPEN    #${ch.ticket.number}  ${ch.ticket.title}` : '  (nothing open right now)';
        return ['Tickets:', open, ...closed.map((f) => `  CLOSED  #${f.replace(/\..*$/, '')}  (see ~/tickets/closed/${f})`)].join('\n');
      }
      if (sub === 'show') {
        if (!ch || !ch.ticket) return 'No ticket is open right now.';
        const steps = eng.steps();
        const out = [`TICKET #${ch.ticket.number}  ${ch.ticket.title}`, `Status: ${s.flags.ticket_accepted ? 'ACCEPTED' : 'OPEN'}`, ''];
        steps.forEach((x) => out.push(`  [${x.done ? 'x' : ' '}] ${x.text}`));
        const nxt = eng.nextStep();
        out.push('', nxt ? `Next: ${nxt.text}\n(type "hint" if you are not sure how)` : 'All done here.');
        return out.join('\n');
      }
      if (sub === 'accept') {
        if (!ch || !ch.ticket) return 'There is no ticket to accept right now.';
        if (s.flags.ticket_accepted) return `Ticket #${ch.ticket.number} is already accepted.`;
        const left = eng.steps().filter((x) => !x.done && !x.final);
        if (left.length) return ['Not yet. Before you accept this ticket, finish:', ...left.map((x) => `  [ ] ${x.text}`), '', '(type "ticket show" to see your whole checklist)'].join('\n');
        s.flags.ticket_accepted = true;
        return `Ticket #${ch.ticket.number} accepted. It is on you now, Doug.`;
      }
      throw new ShellError(`ticket: I don't know "${sub}". Try:  ticket show   ticket list   ticket accept`);
    },
  },

  {
    name: 'mail', summary: 'read your messages',
    usage: 'mail [number]',
    desc: 'With no number it lists your inbox. With a number it opens that message. Messages you have opened are marked as read.',
    examples: ['mail', 'mail 1'], see: ['help'],
    run(args, ctx) {
      const s = ctx.state;
      if (!s.mail.length) return 'No mail.';
      const a = args[0] === 'read' ? args[1] : args[0];
      if (a === undefined) {
        const un = s.mail.filter((m) => !s.mailRead[m.id]).length;
        const rows = s.mail.map((m, i) => `  ${s.mailRead[m.id] ? ' ' : 'N'} ${String(i + 1).padStart(2)}  ${m.from.replace(/\s*<.*>/, '').padEnd(16).slice(0, 16)}  ${m.subject.padEnd(40).slice(0, 40)}  ${m.date}`);
        return [`Inbox: ${s.mail.length} message${s.mail.length > 1 ? 's' : ''}, ${un} unread  (N = unread)`, '', ...rows, '', 'Read one with:  mail 1'].join('\n');
      }
      const i = parseInt(a, 10);
      if (!(i >= 1 && i <= s.mail.length)) throw new ShellError(`mail: there is no message "${a}". Type  mail  to see the list.`);
      const m = s.mail[i - 1];
      s.mailRead[m.id] = true;
      const more = s.mail.length > 1 ? `\n(back to the list: mail)` : '';
      return `From:    ${m.from}\nDate:    ${m.date}\nSubject: ${m.subject}\n\n${m.body.replace(/\n$/, '')}\n${more}`;
    },
  },

  {
    name: 'beginner', summary: 'turn the little [tip] lines on or off',
    usage: 'beginner [on | off]',
    desc: 'Beginner mode adds short [tip] lines at key moments. It is on by default.',
    examples: ['beginner off', 'beginner on'], see: ['help'],
    run(args, ctx) {
      const f = ctx.state.flags;
      if (args[0] === 'on') f.beginner = true;
      else if (args[0] === 'off') f.beginner = false;
      else return `Beginner mode is ${f.beginner ? 'on' : 'off'}. Change it with:  beginner on   or   beginner off`;
      return `Beginner mode ${f.beginner ? 'on. You will see [tip] lines.' : 'off. You are on your own.'}`;
    },
  },
];
