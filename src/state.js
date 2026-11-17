// everything that gets saved lives in one plain object.

export const USER = 'drattman';
export const HOST = 'annex-03';
export const BASE = Date.UTC(2031, 2, 4, 22, 41, 7); // Tue Mar 4 2031, 22:41:07 in-world

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

export function clock(state) { return new Date(BASE + state.t * 1000); }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');

export function fmtClock(d) { return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`; }
export function fmtDate(d) { return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${fmtClock(d)} ${d.getUTCFullYear()}`; }
export function fmtShort(d) { return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; }
export function fmtStamp(d) { return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${fmtClock(d)}`; }
