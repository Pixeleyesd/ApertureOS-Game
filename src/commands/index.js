import files from './files.js';
import system from './system.js';
import guide from './guide.js';
import stubs from './stubs.js';
import services from './services.js';
import cores from './cores.js';
import reply from './reply.js';
import tier3 from './tier3.js';

// later groups win if two commands share a name, so a chapter's real implementation can replace a stub by being listed after it.
export default [...stubs, ...files, ...system, ...guide, ...services, ...cores, ...reply, ...tier3];
