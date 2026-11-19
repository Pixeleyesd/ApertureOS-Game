// reply: how the player answers central when she asks a question (chapter 5 on).
// a chapter opens a question with  set: flag.asking = q1  and reads the answer back
// from the flags this sets:  q1_yes  q1_no  q1_why   (swap q1 for the question's name)

import { ShellError } from '../shell.js';
import { setFlag } from '../state.js';

export default [{
  name: 'reply', locked: true, summary: 'answer the central system',
  usage: 'reply <yes | no | why>',
  desc: 'When the central system asks you something and waits, this is how you answer. "yes" and "no" are your answer. "why" asks her to explain herself first, and you still have to answer afterwards. You can only say "why" once per question.',
  examples: ['reply why', 'reply yes', 'reply no'], see: ['mail'],
  lockedMsg: 'reply: nobody has asked you anything yet.',
  run(args, ctx) {
    const s = ctx.state;
    const q = s.flags.asking;
    const word = (args.filter((a) => !a.startsWith('-'))[0] || '').toLowerCase();
    if (!q) throw new ShellError('reply: nobody is waiting on an answer from you right now.');
    const w = { y: 'yes', yes: 'yes', n: 'no', no: 'no', why: 'why' }[word];
    if (!w) throw new ShellError(`reply: say yes, no or why. For example:  reply why`);
    if (w === 'why') {
      if (s.flags[q + '_why']) throw new ShellError('reply: she has already explained. Answer her with  reply yes  or  reply no');
      setFlag(s, q + '_why', true);
      return 'Sent to central:  why?';
    }
    setFlag(s, q + '_' + w, true);
    setFlag(s, 'asking', false);
    return `Sent to central:  ${w}.`;
  },
}];
