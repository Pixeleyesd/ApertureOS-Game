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
check('chapter 2 ends cleanly', fin.includes('Part 1 of the runbook is finished') && fin.includes('end of the chapters written so far'));
check('help after end does not crash', type('help').includes('You are in'));
check('save round trips', JSON.parse(JSON.stringify(world.save())).flags.ticket_accepted === true);

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

console.log(failed ? `\n${failed} FAILED` : '\nall good');
process.exit(failed ? 1 : 0);
