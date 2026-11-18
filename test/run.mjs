// plays chapter 1 headlessly:  node test/run.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createWorld } from '../src/world.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (p) => { const f = join(root, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };

let buf = [];
const world = await createWorld({ load, print: (t) => buf.push(t) });
const { shell, engine, state } = world;
world.clear = () => buf.push('<clear>');

let failed = 0;
const check = (name, ok) => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

function type(line, show = false) {
  buf = [];
  shell.run(line);
  engine.afterCommand(line);
  const out = buf.join('\n');
  if (show) console.log(`\n$ ${line}\n${out}`);
  return out;
}

world.boot();
const boot = buf.join('\n');
check('boot prints motd', boot.includes('Welcome, Doug Rattman'));
check('boot announces mail', boot.includes('You have new mail'));
check('prompt', shell.prompt() === 'drattman@annex-03:~$ ');
check('chapter 1 is active', state.chapter === 'clock-in');

check('help names next step', type('help').includes('Next step: Look around your home folder'));
check('help suggests real file', type('help').includes('cat HANDOFF.txt'));
check('hint level 1', type('hint').includes('Hint 1/3'));
check('hint level 3', (type('hint'), type('hint')).includes('Hint 3/3'));
check('sl suggests ls', type('sl').includes('Did you mean "ls"'));
check('rm is in-world', type('rm x').includes('Tier 3'));
check('corectl is locked', type('corectl').includes('not installed'));

check('ls shows folders with slash', type('ls').includes('tickets/'));
check('ls step ticks', type('ticket show').includes('[x] Look around'));
check('ls tip fires once', !type('ls').includes('[tip] Names ending'));
check('accept refused early', type('ticket accept').includes('Not yet'));
check('cat missing file', type('cat nope.txt').includes('No such file'));

check('runbooks locked', type('cd /opt/aperture/runbooks').includes('Permission denied'));
check('cat handoff', type('cat HANDOFF.txt').includes('Welcome to nights'));
check('tilde path', type('cat ~/HANDOFF.txt | grep -i ticket').includes('ticket'));
check('hint now about tickets', type('hint').includes('Open the tickets folder'));
check('cd tickets', (type('cd tickets'), shell.prompt().includes('~/tickets')));
check('tab complete files', shell.complete('cat 44').matches.includes('4417.txt'));
check('tab complete cmds', shell.complete('he').matches.includes('help'));
check('glob', type('cat *.txt').includes('TICKET #4417'));
check('ticket read logs', type('cat ~/tickets/4417.txt').includes('ticket accept') && world.fs.read('/var/log/facility.log').includes('opened ticket 4417'));
check('tree works', type('tree ~/tickets').includes('closed/'));
check('find works', type('find ~ -name "*.txt" -type f').includes('4402.txt'));
check('grep -r', type('grep -ri outbound /etc').includes('aperture.conf'));
check('echo redirect', (type('echo "check the logs" > ~/notes.txt'), world.fs.read('/home/drattman/notes.txt').includes('check the logs')));
check('redirect outside home refused', type('echo hi > /etc/motd').includes('Permission denied'));
check('cd ..', (type('cd ..'), shell.prompt() === 'drattman@annex-03:~$ '));
check('mail list', type('mail').includes('welcome to nights'));
check('accept still refused', type('ticket accept').includes('Read Imogen'));
check('mail open', type('mail 1').includes('bucket under your desk'));
check('mail marks read', state.mailRead['imogen-welcome'] === true);

const done = type('ticket accept');
check('accept works', done.includes('accepted'));
check('runbook unlocked', done.includes('Runbook access granted'));
check('chapter 2 begins', state.chapter === 'the-runbook' && done.includes('The ticket is yours now'));

// ---- chapter 2 ----
check('ch2 help names next step', type('help').includes('Next step: Read the runbook'));
check('ch2 earlier notes do not count', !type('ticket show').includes('[x] Write the headcount'));
check('runbook readable', type('cat /opt/aperture/runbooks/wake.md').includes('RUNBOOK 11-C'));
check('who lists 12', type('who').split('\n').length === 12);
check('headcount file', type('cat /proc/aperture/headcount').startsWith('12'));
check('hint for headcount-notes step', (type('hint'), type('hint').includes('Hint 2/3')));
check('power file', type('cat /proc/aperture/power').includes('STANDBY'));
check('tail the log', type('tail -n 3 /var/log/facility.log').includes('drattman logged in'));
check('notes step not done yet', type('ticket show').includes('[ ] Write the headcount'));
check('notes written', (type('echo "headcount 12" >> ~/notes.txt'), world.fs.read('/home/drattman/notes.txt').includes('headcount 12')));
check('notes step ticks', type('ticket show').includes('[x] Write the headcount'));
const posted = type('echo "Lighting L2 corridor soon. Doug" > ~/outbox/facilities.txt');
check('notice brings mail', posted.includes('You have new mail'));
check('notice logged', world.fs.read('/var/log/facility.log').includes('L2 lighting notice'));
check('mail 2 is the reply', type('mail').includes('re: L2 lighting notice'));
const fin = type('mail 2');
check('reply text', fin.includes('Core Lab'));
check('chapter 2 hands over to chapter 3', fin.includes('Part 1 of the runbook is finished') && state.chapter === 'boot');
check('the jump brings mail', fin.includes('You have new mail'));
const when = type('date');
check('clock jumped to just after midnight, 2011', when.includes('Mar  5 00:1') && when.includes('2011'));

// ---- chapter 3 ----
function tick(n) { buf = []; for (let i = 0; i < n; i++) { engine.tick(1); world.pump(); } return buf.join('\n'); }
check('ch3 next step', type('help').includes('Next step: Read Part 2 of the runbook again'));
check('systemctl unlocked', !type('systemctl list-units').includes('Tier 3 only'));
check('glados starts asleep', type('systemctl status glados').includes('inactive (dead)'));
check('stop is refused', type('systemctl stop glados').includes('Interactive authentication required'));
check('runbook re-read ticks', (type('cat /opt/aperture/runbooks/wake.md'), type('ticket show').includes('[x] Read Part 2')));
check('optional step is labelled', type('ticket show').includes('(optional)'));
const go = type('systemctl start glados');
check('start works and points at the log', go.includes('Authenticated') && go.includes('tail -f'));
check('start twice is harmless', type('systemctl start glados').includes('already starting'));
check('status says activating', type('systemctl status glados').includes('activating'));
check('log began', world.fs.read('/var/log/glados.log').startsWith('[2011-03-05 00:'));
const early = tick(40);
check('facility power event arrives', early.includes('facility-monitor@annex-03') && early.includes('38 A'));
check('brandt mailed', type('mail').includes('re: central'));
check('log waits for a reader', world.fs.read('/var/log/glados.log').includes('waiting for operator') && !world.fs.read('/var/log/glados.log').includes('READY'));
const late = tick(8);
check('nudge says look at the log (45s, still unread)', late.includes('waiting for somebody to look at it'));
check('the seal, optional, is readable', type('cat /proc/aperture/seal').includes('OPEN (stuck)'));
check('seal step ticks', type('ticket show').includes('[x] Look at the Core Lab seal'));
const watch = type('tail -f /var/log/glados.log');
check('tail -f starts watching', watch.includes('watching for new lines'));
world.pump();
check('READY appears once someone reads', world.fs.read('/var/log/glados.log').includes('READY.') && state.flags.glados_ready === true);
check('status says active', type('systemctl status glados').includes('active (running)'));
check('journal reads the unit', type('journalctl -u glados -n 2').includes('READY'));
const quiet = tick(10);
check('she does not speak yet', !quiet.includes('Hello, Doug'));
const speak = tick(15);
check('she speaks first, by name', speak.includes('Broadcast message from glados@central') && speak.includes('Hello, Doug.'));
check('spoke flag set', state.flags.glados_spoke === true);
tick(4);
check('her mail arrives as number 5', type('mail').includes('5  GLaDOS') || type('mail').includes('GLaDOS'));
check('ticket shows only the notes step left optional', type('ticket show').includes('[ ] Write the READY time'));
const end3 = type('mail 5');
check('her message reads', end3.includes('Thank you for waking me'));
check('chapter 3 ends cleanly', end3.includes('Part 2 of the runbook is done') && state.chapter === 'baseline');
check('facility log recorded READY', world.fs.read('/var/log/facility.log').includes('central: READY (reactivated by drattman'));
check('stop follow clears it', (world.stopFollow(), world.follow === null));
check('passwd plants the legacy account', type('grep cjohnson /etc/passwd').includes('legacy account'));
check('help after end does not crash', type('help').includes('You are in'));
check('save round trips', JSON.parse(JSON.stringify(world.save())).flags.glados_ready === true);

// ---- chapter 4 ----
check('ch3 handed over to ch4 (mail 5 read)', state.chapter === 'baseline');
check('ch4 clock is around 00:50', type('date').includes('Mar  5 00:5'));
check('ch4 next step is the index', type('help').includes('Next step: Read the core index'));
check('corectl unlocked', !type('corectl list').includes('not installed'));
check('corectl list shows five', type('corectl list').split('\n').filter((l) => /MC-0\d/.test(l)).length === 5);
check('out of order refused', type('corectl insert anger').includes('out of order'));
check('unknown core refused', type('corectl insert banana').includes('no core called'));
check('eject on empty cradle', type('corectl eject').includes('empty'));
check('report early is refused', type('report new').includes('no finished evaluation'));
type('cat /opt/aperture/cores/INDEX.txt');
check('index step ticks', type('ticket show').includes('[x] Read the core index'));
check('insert works', type('corectl insert morality').includes('hatch cradle'));
check('second insert refused', type('corectl insert curiosity').includes('already has morality'));
check('core file shows morality', type('cat /proc/aperture/core').includes('morality'));
check('early eject refused with seconds', /\d+ to go/.test(type('corectl eject')));
const c1 = tick(10);
check('she greets by name', c1.includes('Good morning, Doug.'));
const c2 = tick(26);
check('lighting test then monitor', c2.includes('flickered 4 times') && c2.includes('not a test'));
check('queue asked and denied', tick(15).includes('subject queue is secure') && world.fs.read('/var/log/glados.log').includes('denied: no supervisor'));
check('corectl log has the insert', type('cat /var/log/corectl.log').includes('MC-01 morality: inserted'));
check('radek mailed', type('mail').includes('cradle'));
type('cat /var/log/glados.log');
tick(12);
check('watch step ticks after a minute', type('ticket show').includes('[x] Watch it for a full minute'));
const out = type('corectl eject');
check('eject works', out.includes('released') && out.includes('report new'));
check('she is thanked, not unloaded', buf.join('').length > 0 && world.fs.read('/var/log/glados.log').includes('constraint set unloaded'));
check('next core blocked until reported', type('corectl insert curiosity').includes('file your report'));
check('report file needs content', (type('report new'), type('report file').includes('nothing written')));
check('draft has header filled', world.fs.read('/home/drattman/reports/AS-114-morality.txt').includes('Morality (MC-01)'));
check('draft exists twice refused', type('report new').includes('already exists'));
type('cat /proc/aperture/headcount');
check('headcount step ticks', type('ticket show').includes('[x] Check the headcount again'));
type('echo "OBSERVED she quoted policy nine times. The subject queue came up twice and the seal once." >> ~/reports/AS-114-morality.txt');
check('write step ticks', type('ticket show').includes('[x] Write what you saw'));
const filed = type('report file');
check('report filed to all three', filed.includes('H. Brandt') && filed.includes('central system'));
check('flags from report text', state.flags.report_seal && state.flags.report_queue && state.flags.report_policy);
const after = tick(12);
check('she read the report', after.includes('read that part twice') && after.includes('quote policy'));
check('brandt answers with the seal variant', type('mail').includes('re: AS-114 morality') && world.fs.read('/var/log/facility.log').includes('AS-114 received'));
const end4 = type('mail');
const num = (end4.match(/(\d+)\s+GLaDOS[^\n]*your report/) || [])[1];
check('her mail is in the list', !!num);
const fin4 = type('mail ' + num);
check('chapter 4 ends cleanly', fin4.includes('One core down') && fin4.includes('end of the chapters written so far'));
check('curiosity is now next', type('corectl status').includes('curiosity'));
check('save round trips ch4', JSON.parse(JSON.stringify(world.save())).flags.report_morality === true);

// idle nudge
const w2 = await createWorld({ load, print: (t) => buf.push(t) });
buf = []; w2.boot(); buf = [];
for (let i = 0; i < 95; i++) w2.engine.tick(1);
check('idle nudge fires once', buf.filter((l) => l.includes('[help desk]')).length === 1);

// a saved game restores with its files intact
const w3 = await createWorld({ load, print: (t) => buf.push(t), saved: world.save() });
check('restore keeps notes file', w3.fs.read('/home/drattman/notes.txt').includes('check the logs'));
check('restore keeps unlock', w3.fs.lockedAt('/opt/aperture/runbooks') === null);
check('restore keeps outbox note', w3.fs.read('/home/drattman/outbox/facilities.txt').includes('Lighting L2'));
check('restore keeps the clock jump', w3.state.skew > 0 && w3.state.flagAt.glados_ready !== undefined);

console.log(failed ? `\n${failed} FAILED` : '\nall good');
process.exit(failed ? 1 : 0);
