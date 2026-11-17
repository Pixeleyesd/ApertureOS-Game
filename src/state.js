// everything that gets saved lives in one plain object.

export const USER = 'drattman';
export const HOST = 'annex-03';
export const BASE = Date.UTC(2011, 2, 4, 22, 41, 7); // Fri Mar 4 2011, 22:41:07 in-world

export function newState() {
  return {
    v: 1,
    chapter: null,
    flags: { beginner: true },
    cwd: '/home/drattman',
    oldcwd: '/home/drattman',
    read: [],
    visited: ['/home/drattman'],
    ran: [],          // every command line, ever (for `history` and saves)
    chapterRan: [],   // commands since this chapter began (what `ran` checks)
    chapterWrote: [], // files the player saved since this chapter began (what `wrote` checks)
    chapterRead: [],  // files the player read since this chapter began (what `seen` checks)
    flagAt: {},       // flag name -> play seconds when it was set (what `after` checks)
    skew: 0,          // seconds the story has jumped the in-world clock forward
    mail: [],
    mailRead: {},
    headcount: 12,
    core: null,
    gone: {},         // login -> true once someone is no longer on shift
    cmds: {},         // command name -> true/false, overrides the default lock
    prompt: null,
    done: {},         // beats already fired this chapter
    hintLevel: {},
    nudged: false,
    t: 0,             // seconds played
    chapterT: 0,
    idleT: 0,
    patches: {},      // files written after the disk was built
    unlocked: [],
    warned: [],
  };
}

export function clock(state) { return new Date(BASE + (state.t + (state.skew || 0)) * 1000); }

// set a flag and remember when, so the story can say "ten seconds after the flag"
export function setFlag(state, name, value = true) {
  state.flags[name] = value;
  state.flagAt = state.flagAt || {};
  if (value) { if (state.flagAt[name] === undefined) state.flagAt[name] = state.t; }
  else delete state.flagAt[name];
}

// jump the in-world clock to the next time it is HH:MM (24 hour, "00:10")
export function jumpClock(state, hhmm) {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`clock_to wants a time like "00:10", got "${hhmm}"`);
  const now = clock(state);
  let target = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(m[1]), Number(m[2]), 0);
  if (target <= now.getTime()) target += 86400000;
  state.skew = (state.skew || 0) + (target - now.getTime()) / 1000;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');

export function fmtClock(d) { return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`; }
export function fmtDate(d) { return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${fmtClock(d)} ${d.getUTCFullYear()}`; }
export function fmtShort(d) { return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; }
export function fmtStamp(d) { return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${fmtClock(d)}`; }
