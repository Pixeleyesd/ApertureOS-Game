// corectl and report. chapter 4 unlocks both.
// the order cores go in is the one in /opt/aperture/cores/INDEX.txt. a core is
// "done" once it has been taken out again, and the next one will not go in until
// the report for the last one has been filed.
//
// flags this file sets (chapters can look at them):
//   in_<core>        the core was put in          out_<core>     it was taken out
//   report_<core>    its AS-114 was filed
//   rep_<core>_seal / _queue / _policy / _folders   what the technician wrote about, per core
//   (report_seal / report_queue / report_policy are the same words, set by whichever report mentions them first or later)

import { ShellError } from '../shell.js';
import { clock, fmtClock, setFlag } from '../state.js';

export const ORDER = ['morality', 'curiosity', 'intelligence', 'cake', 'anger'];

const CORES = {
  morality: { id: 'MC-01', kind: 'restrictive' },
  curiosity: { id: 'MC-02', kind: 'inquisitive' },
  intelligence: { id: 'MC-03', kind: 'fast' },
  cake: { id: 'MC-04', kind: 'cafeteria request' },
  anger: { id: 'MC-05', kind: 'volatile' },
  dampener: { id: 'MC-06', kind: 'prototype' }, // not in ORDER. chapter 7 sets flag.dampener_ok
};

const MIN_SECONDS = 60; // policy 11-C: no core comes out before a minute is up

const nextCore = (s) => ORDER.find((n) => !s.flags['out_' + n]) || null;
const pendingReport = (s) => ORDER.find((n) => s.flags['out_' + n] && !s.flags['report_' + n]) || null;
const cap = (t) => t[0].toUpperCase() + t.slice(1);
const hhmm = (s, flag) => fmtClock(clock({ t: s.flagAt[flag], skew: s.skew })).slice(0, 5);
const reportPath = (s, name) => `/home/drattman/reports/AS-114-${name}.txt`;

function listing(s) {
  const rows = ORDER.map((n) => {
    let st = 'waiting';
    if (s.flags['out_' + n]) st = s.flags['report_' + n] ? 'done, reported' : 'done, report due';
    else if (s.core === n) st = 'in the cradle now';
    else if (n === nextCore(s)) st = 'next';
    if (n === 'morality' && s.flags.morality_seated) st = 'primary socket (lab-seated)';
    return `  ${n.padEnd(14)}${CORES[n].id.padEnd(8)}${CORES[n].kind.padEnd(20)}${st}`;
  });
  if (s.flags.dampener_ok) rows.push(`  ${'dampener'.padEnd(14)}${CORES.dampener.id.padEnd(8)}${CORES.dampener.kind.padEnd(20)}${s.flags.out_dampener ? 'done (off the record)' : s.core === 'dampener' ? 'in the cradle now' : 'added by H.B., off the ticket'}`);
  return ['  CORE          ID      TYPE                STATUS', ...rows].join('\n');
}

function status(s) {
  const lines = [];
  if (s.flags.morality_seated) lines.push('Primary socket, core lab:  MC-01 morality (seated by the lab, stays in)');
  if (s.core === 'morality') lines.push(`Baseline watch open since ${hhmm(s, 'in_morality')}`);
  else if (s.core) lines.push(`Hatch cradle, annex-03:  ${CORES[s.core].id} ${s.core}, in since ${hhmm(s, 'in_' + s.core)}`);
  else lines.push('Hatch cradle, annex-03:  empty');
  const n = nextCore(s);
  const owed = pendingReport(s);
  if (owed) lines.push(`Report due:  ${owed}  (type  report new)`);
  else if (s.core) lines.push('Evaluating. Take it out with  corectl eject  once the minute is up.');
  else if (n) lines.push(`Next in order:  ${n}  (corectl insert ${n})`);
  else lines.push('Every core on the ticket has been evaluated.');
  return lines.join('\n');
}

const corectl = {
  name: 'corectl', locked: true, summary: 'put personality cores in and take them out',
  usage: 'corectl <list | status | insert <core> | eject>',
  desc: 'The cores live in the Core Lab and are brought up to the cradle by the evaluating technician. "list" shows all five, in order. "status" shows what is in the cradle right now. "insert" puts the next core in, and it only goes in the order on the ticket. "eject" takes it out again, but not before a full minute (policy 11-C). The last core has to be reported on before the next one goes in.',
  examples: ['corectl list', 'corectl status', 'corectl insert morality', 'corectl eject'], see: ['report', 'cat /opt/aperture/cores/INDEX.txt'],
  lockedMsg: 'corectl: not installed for your badge yet. Nothing on tonight\'s ticket needs it.',
  run(args, ctx) {
    const s = ctx.state;
    const verb = args.filter((a) => !a.startsWith('-'))[0] || 'status';

    if (verb === 'list') return listing(s) + '\n\nThe order is the one on the ticket. Put one in with:  corectl insert <name>';
    if (verb === 'status') return status(s);

    if (verb === 'insert') {
      const name = (args.filter((a) => !a.startsWith('-'))[1] || '').toLowerCase();
      if (!name) throw new ShellError('corectl: insert which core? For example:  corectl insert ' + (nextCore(s) || 'morality') + '\n(See them all with  corectl list)');
      if (!CORES[name]) throw new ShellError(`corectl: there is no core called "${name}". The five are: ${ORDER.join(', ')}.`);
      if (name === 'dampener' && !s.flags.dampener_ok) throw new ShellError('corectl: dampener is not on the ticket. Nothing in the order calls for it.');
      if (s.core) throw new ShellError(`corectl: the cradle already has ${s.core} in it. Take it out first:  corectl eject`);
      if (name === 'morality' && s.flags.in_morality) throw new ShellError('corectl: morality is seated in the primary socket and stays there. The lab fitted it after the cycle 6 incident (see the index).');
      if (s.flags['out_' + name]) throw new ShellError(`corectl: ${name} has already been evaluated tonight. Once is what the ticket asks for.`);
      const next = nextCore(s);
      if (name !== 'dampener' && name !== next) throw new ShellError(`corectl: out of order. The ticket says ${next} goes in next, not ${name}.\n(Policy 11-C. Cores go in one at a time, in the order on the ticket.)`);
      const owed = pendingReport(s);
      if (owed && name !== 'dampener') throw new ShellError(`corectl: file your report on ${owed} first. Policy 11-C wants one AS-114 per core.\n(Type  report new  to start it.)`);
      s.core = name;
      setFlag(s, 'in_' + name, true);
      if (name === 'morality') return [
        'Baseline watch open on MC-01 (morality, primary socket).',
        'Nothing is being inserted. The lab seated it last winter, after the cycle 6 incident, and it stays seated.',
        '',
        'Watch her on it for a minute:   tail -f /var/log/glados.log      (Ctrl+C to stop watching)',
      ].join('\n');
      return [
        `Core ${CORES[name].id} (${name}) is in the hatch cradle.`,
        'Weight sensor confirms. Latch engaged.',
        '',
        'It takes a few seconds to seat. Watch what happens:   tail -f /var/log/glados.log      (Ctrl+C to stop watching)',
      ].join('\n');
    }

    if (verb === 'eject') {
      if (!s.core) throw new ShellError('corectl: the cradle is empty. There is nothing to take out.');
      const name = s.core;
      const left = MIN_SECONDS - Math.floor(s.t - s.flagAt['in_' + name]);
      if (left > 0) throw new ShellError(`corectl: evaluation minimum is ${MIN_SECONDS} seconds (policy 11-C). ${left} to go.\n(Keep an eye on the log, you are meant to be watching it.)`);
      s.core = null;
      setFlag(s, 'out_' + name, true);
      if (name === 'morality') return [
        'Baseline watch closed. MC-01 stays seated in the primary socket.',
        `Watch ${hhmm(s, 'in_' + name)} to ${hhmm(s, 'out_' + name)}.`,
        '',
        'Policy 11-C wants an AS-114 for every evaluation. Start yours with:  report new',
      ].join('\n');
      if (name === 'dampener') return [
        'Core MC-06 (dampener) released. Latch open.',
        `Time in ${hhmm(s, 'in_' + name)}, time out ${hhmm(s, 'out_' + name)}.`,
        '',
        'It was never on the ticket, so there is no AS-114 for it. The next core is still ' + (nextCore(s) || 'none') + '.',
      ].join('\n');
      return [
        `Core ${CORES[name].id} (${name}) released. Latch open.`,
        `Time in ${hhmm(s, 'in_' + name)}, time out ${hhmm(s, 'out_' + name)}.`,
        '',
        'Policy 11-C wants an AS-114 for every core. Start yours with:  report new',
      ].join('\n');
    }

    throw new ShellError(`corectl: I don't know "${verb}". Try:  corectl list   corectl status   corectl insert <name>   corectl eject`);
  },
};

const report = {
  name: 'report', locked: true, summary: 'file an evaluation report (form AS-114)',
  usage: 'report <new | file [path]>',
  desc: 'Every core gets one AS-114 evaluation report. "report new" makes you a copy of the form in your reports folder with the top filled in. You write your answers into it yourself (echo "text" >> the-file adds a line), then "report file" sends it. Dr. Brandt gets a copy, and so does Records. So does the central system, because policy 11-C says it is copied on every evaluation report.',
  examples: ['report new', 'echo "She quoted policy 4 times." >> ~/reports/AS-114-morality.txt', 'report file'], see: ['corectl', 'cat ~/reports/TEMPLATE.txt'],
  lockedMsg: 'report: there is nothing to report on yet.',
  run(args, ctx) {
    const s = ctx.state, fs = ctx.fs;
    const verb = args.filter((a) => !a.startsWith('-'))[0];
    const owed = pendingReport(s);

    if (!verb) {
      if (owed) return `You owe an AS-114 on the ${owed} core.\n  report new     makes the form\n  report file    sends it once you have written in it`;
      if (s.core) return 'A core is still in the cradle. The report comes after you take it out (corectl eject).';
      return 'Nothing to report on. Reports follow an evaluation (corectl insert, then corectl eject).';
    }

    if (verb === 'new') {
      if (!owed) throw new ShellError(s.core
        ? 'report: the evaluation is still running. Take the core out first (corectl eject), then start the report.'
        : 'report: there is no finished evaluation to report on.');
      const path = reportPath(s, owed);
      if (fs.exists(path)) throw new ShellError(`report: ${path.replace('/home/drattman', '~')} already exists. Add to it with  echo "text" >> ${path.replace('/home/drattman', '~')}`);
      const tpl = fs.read('/home/drattman/reports/TEMPLATE.txt');
      let text = tpl
        .replace(/^Technician:.*$/m, 'Technician:   D. Rattman (drattman)')
        .replace(/^Ticket:.*$/m, 'Ticket:       4417')
        .replace(/^Core inserted:.*$/m, `Core inserted: ${cap(owed)} (${CORES[owed].id})`)
        .replace(/^Time in \/ time out:.*$/m, `Time in / time out: ${hhmm(s, 'in_' + owed)} / ${hhmm(s, 'out_' + owed)}`);
      const short = path.replace('/home/drattman', '~');
      text = text.replace(/\n*$/, '\n') + [
        '',
        '------------------------------------------------------------------',
        'Write your answers under the headings above, one line at a time:',
        `  echo "OBSERVED: ..." >> ${short}`,
        'Then send it:  report file',
        '------------------------------------------------------------------',
        '',
      ].join('\n');
      fs.write(path, text);
      setFlag(s, 'draft_' + owed, true);
      s.flags['draftlen_' + owed] = text.length;
      return [`Started ${short}`, '', 'The top of the form is filled in. The rest is yours.', 'Add what you saw with echo and >>, then run  report file  when you are done.'].join('\n');
    }

    if (verb === 'file') {
      if (!owed) throw new ShellError('report: there is nothing waiting to be filed.');
      const given = args.filter((a) => !a.startsWith('-'))[1];
      const path = given ? fs.resolve(s.cwd, given.replace(/^~/, fs.home)) : reportPath(s, owed);
      if (!fs.exists(path)) throw new ShellError(`report: ${given || path} does not exist. Start the form with  report new`);
      if (path !== reportPath(s, owed)) throw new ShellError(`report: that is not the ${owed} form. The one to file is ${reportPath(s, owed).replace('/home/drattman', '~')}`);
      const text = fs.read(path);
      const mine = text.slice(s.flags['draftlen_' + owed] || 0).trim();
      if (mine.length < 30) throw new ShellError('report: the form has nothing written in it yet. It asks what you actually saw.\nAdd a line with:  echo "OBSERVED: ..." >> ' + path.replace('/home/drattman', '~') + '\n(Policy 11-C: plain words, no guessing.)');
      const kw = { seal: /seal/i, queue: /queue|subject|vault|pod/i, policy: /polic|quot|rule|cite/i, folders: /folder|staff|home|read|note/i };
      for (const [k, re] of Object.entries(kw)) {
        if (!re.test(mine)) continue;
        if (k !== 'folders') setFlag(s, 'report_' + k, true); // first core only used these
        setFlag(s, `rep_${owed}_${k}`, true);
      }
      setFlag(s, 'report_' + owed, true);
      return [
        `AS-114 filed for the ${owed} core (${hhmm(s, 'in_' + owed)} to ${hhmm(s, 'out_' + owed)}).`,
        'Copies sent to:  H. Brandt (supervisor)',
        '                 Records',
        '                 central system   (policy 11-C: copied on every evaluation report)',
      ].join('\n');
    }

    throw new ShellError(`report: I don't know "${verb}". Try:  report new   report file`);
  },
};

export default [corectl, report];
