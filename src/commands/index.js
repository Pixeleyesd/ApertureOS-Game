import files from './files.js';
import system from './system.js';
import guide from './guide.js';
import stubs from './stubs.js';

// later groups win if two commands share a name, so a chapter's real
// implementation can replace a stub by being listed after it.
export default [...stubs, ...files, ...system, ...guide];
