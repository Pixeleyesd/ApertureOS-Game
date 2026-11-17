// commands that exist later in the story, plus real ones this terminal won't allow.
// the story unlocks the first group with  unlock_cmd. the second group stays off.

const later = (name, summary, msg) => ({
  name, summary, locked: true, usage: name, desc: summary, examples: [], see: [],
  lockedMsg: msg, run() {},
});

const policy = (name, msg) => ({
  name, summary: 'not available on this terminal', locked: true, hidden: true,
  usage: name, desc: msg, examples: [], see: [], lockedMsg: msg, run() {},
});

const note = 'To save a note, use:  echo "your text" > notes.txt';

export default [
  later('corectl', 'swap personality cores', 'corectl: not installed for your badge yet. Nothing on tonight\'s ticket needs it.'),
  later('report', 'file an evaluation report', 'report: there is nothing to report on yet.'),
  later('wall', 'broadcast a message to everyone', 'wall: broadcasting is a supervisor function.'),
  later('write', 'message one person', 'write: direct messaging is off on annex terminals. Use  mail.'),
  later('kill', 'stop a running program', 'kill: Tier 3 only.'),
  later('top', 'watch programs live', 'top: live monitoring is Tier 3 only. Try  ps  for a snapshot.'),
  later('crontab', 'see scheduled jobs', 'crontab: scheduled jobs are Tier 3 only.'),
  later('last', 'see past logins', 'last: login history is Tier 3 only. Try  who  for who is on right now.'),

  policy('rm', 'rm: file deletion needs a Tier 3 badge (Maintenance Policy 4-B). Nothing here needs deleting tonight.'),
  policy('mv', `mv: this terminal is read-mostly. ${note}`),
  policy('cp', `cp: this terminal is read-mostly. ${note}`),
  policy('mkdir', `mkdir: this terminal is read-mostly. ${note}`),
  policy('touch', `touch: this terminal is read-mostly. ${note}`),
  policy('chmod', 'chmod: permissions are managed centrally.'),
  policy('chown', 'chown: permissions are managed centrally.'),
  policy('vim', `vim: no text editor is installed on annex terminals. ${note}`),
  policy('vi', `vi: no text editor is installed on annex terminals. ${note}`),
  policy('nano', `nano: no text editor is installed on annex terminals. ${note}`),
  policy('emacs', `emacs: no text editor is installed on annex terminals. ${note}`),
  policy('apt', 'apt: package installs are disabled on facility machines.'),
  policy('apt-get', 'apt-get: package installs are disabled on facility machines.'),
  policy('pip', 'pip: package installs are disabled on facility machines.'),
  policy('npm', 'npm: package installs are disabled on facility machines.'),
  policy('ssh', 'ssh: the annex terminal is on the internal network only. Outside access is switched off for the night (see ticket 4402).'),
  policy('curl', 'curl: the annex terminal is on the internal network only (see ticket 4402).'),
  policy('wget', 'wget: the annex terminal is on the internal network only (see ticket 4402).'),
  policy('ping', 'ping: the annex terminal is on the internal network only (see ticket 4402).'),
];
