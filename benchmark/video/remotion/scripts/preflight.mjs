import {loadConfig,parseArgs} from './config.mjs';
try {const c=loadConfig(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({composition:c.compositionId,timeline:c.timeline,media:c.media},null,2));}catch(e){console.error(e.message);process.exit(1);}
