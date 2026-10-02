import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {projectDir,loadConfig,parseArgs} from './config.mjs';
try{
 const opts=parseArgs(process.argv.slice(2));const c=loadConfig({...opts,allowMissing:true});
 const grid=loadConfig({kind:'Grid',allowMissing:true});const pair=loadConfig({kind:'Matchup',selectedIds:opts.selectedIds,allowMissing:true});
 c.props.durationsByKind={Grid:grid.timeline.durationInFrames,Matchup:pair.timeline.durationInFrames};
 c.props.availableIds=grid.props.availableIds;
 mkdirSync(resolve(projectDir,'.cache'),{recursive:true});
 const path=resolve(projectDir,'.cache/studio-props.json');writeFileSync(path,JSON.stringify(c.props));
 console.log(`Studio props select ${c.compositionId}. Missing footage is labeled; production render requires originals.`);
 const r=spawnSync(process.execPath,[resolve(projectDir,'node_modules/@remotion/cli/remotion-cli.js'),'studio','src/index.ts','--public-dir',c.publicDir,'--props',path],{cwd:projectDir,stdio:'inherit'});
 process.exit(r.status??1);
}catch(e){console.error(e.message);process.exit(1);}
