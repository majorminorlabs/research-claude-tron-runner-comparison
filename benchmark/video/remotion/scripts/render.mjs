import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia} from '@remotion/renderer';
import {mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {projectDir,loadConfig,parseArgs} from './config.mjs';
try {
 const opts=parseArgs(process.argv.slice(2));const c=loadConfig(opts);
 const output=resolve(projectDir,opts.output??`out/${c.compositionId}.mp4`);await mkdir(dirname(output),{recursive:true});
 const serveUrl=await bundle({entryPoint:resolve(projectDir,'src/index.ts'),publicDir:c.publicDir});
 const browserExecutable=process.env.REMOTION_BROWSER_EXECUTABLE;
 const composition=await selectComposition({serveUrl,id:c.compositionId,inputProps:c.props,browserExecutable});
 console.log(`Rendering ${c.compositionId}, ${c.timeline.seconds}s at ${c.props.manifest.fps}fps to ${output}`);
 await renderMedia({serveUrl,composition,inputProps:c.props,codec:'h264',pixelFormat:'yuv420p',crf:18,outputLocation:output,browserExecutable,overwrite:false,concurrency:2,onProgress:({progress})=>{if(Math.round(progress*100)%10===0)process.stdout.write(`\r${Math.round(progress*100)}%`);}});
 console.log(`\nSaved ${output}`);
}catch(e){console.error(e.message);process.exit(1);}
