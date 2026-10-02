// Renderer layout verification only. These labeled PNGs are never gameplay substitutes.
import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill} from '@remotion/renderer';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {projectDir,benchmarkDir,loadConfig,formats} from './config.mjs';
const out=resolve(benchmarkDir,'validation/renderer');await mkdir(out,{recursive:true});
const first=loadConfig({allowMissing:true});
const serveUrl=await bundle({entryPoint:resolve(projectDir,'src/index.ts'),publicDir:first.publicDir});
const browserExecutable=process.env.REMOTION_BROWSER_EXECUTABLE??'<CHROME_EXECUTABLE>';
const results=[];
for(const kind of ['Grid','Matchup'])for(const format of Object.keys(formats)){
 const c=loadConfig({kind,format,allowMissing:true});c.props.layoutQa=true;
 const composition=await selectComposition({serveUrl,id:c.compositionId,inputProps:c.props,browserExecutable});
 await renderStill({serveUrl,composition,inputProps:c.props,output:resolve(out,`${c.compositionId}.png`),imageFormat:'png',browserExecutable});
 results.push({composition:c.compositionId,width:composition.width,height:composition.height,durationInFrames:composition.durationInFrames,selectedIds:c.props.selectedIds,mode:'Labeled missing-footage layout PNG only',status:'passed'});
 console.log(c.compositionId,'passed');
}
await writeFile(resolve(out,'checks.json'),JSON.stringify(results,null,2)+'\n');
