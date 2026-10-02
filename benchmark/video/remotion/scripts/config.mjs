import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export const projectDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const videoDir=resolve(projectDir,'..');
export const benchmarkDir=resolve(videoDir,'..');
export const formats={'16x9':[1920,1080],'4x3':[1600,1200],'1x1':[1440,1440],'9x16':[1080,1920]};
const fail=m=>{throw new Error(m);};
export function validateManifest(m,modelIds){
 if(m.schemaVersion!==1)fail('Unsupported manifest schemaVersion.');
 if(!Number.isInteger(m.fps)||m.fps<1||m.fps>120)fail('fps must be an integer from 1 to 120.');
 if(m.durationSeconds!==null&&(!Number.isFinite(m.durationSeconds)||m.durationSeconds<=0))fail('durationSeconds must be null or positive.');
 if(!Array.isArray(m.clips)||m.clips.length!==modelIds.length)fail('clips must contain each benchmark model exactly once.');
 const seen=new Set();
 for(const c of m.clips){
  if(!modelIds.includes(c.id)||seen.has(c.id))fail(`Unknown or duplicate clip ID: ${c.id}`);seen.add(c.id);
  if(c.file!==`gameplay/${c.id}.mp4`)fail(`Expected gameplay/${c.id}.mp4; media paths must stay inside gameplay/.`);
  if(!Number.isFinite(c.offsetSeconds)||c.offsetSeconds<0)fail(`Invalid offset for ${c.id}.`);
  if(c.durationSeconds!==null&&(!Number.isFinite(c.durationSeconds)||c.durationSeconds<=0))fail(`Invalid duration for ${c.id}.`);
 }
 if(!Array.isArray(m.matchup)||m.matchup.length!==2||new Set(m.matchup).size!==2||m.matchup.some(x=>!modelIds.includes(x)))fail('matchup must select two distinct benchmark model IDs.');
 if(m.audioModel!==null&&!modelIds.includes(m.audioModel))fail('audioModel must be null or a benchmark model ID.');
 if(typeof m.branding?.label!=='string'||typeof m.branding?.subtitle!=='string')fail('Branding label and subtitle must be strings.');
}
export function planTimeline(manifest,ids,durations){
 const availableFrames=ids.map(id=>{
  const clip=manifest.clips.find(c=>c.id===id);
  const trimFrames=Math.round(clip.offsetSeconds*manifest.fps);
  const remainingFrames=Math.floor(durations[id]*manifest.fps)-trimFrames;
  if(remainingFrames<=0)fail(`Offset leaves no footage: ${id}`);
  const requested=clip.durationSeconds===null?remainingFrames:Math.floor(clip.durationSeconds*manifest.fps);
  if(requested<1)fail(`Segment must last at least one frame: ${id}`);
  if(requested>remainingFrames)fail(`Selected duration exceeds available footage: ${id}`);
  return requested;
 });
 const shortest=Math.min(...availableFrames);
 const requested=manifest.durationSeconds===null?shortest:Math.floor(manifest.durationSeconds*manifest.fps);
 if(requested<1)fail('Composition must last at least one frame.');
 if(requested>shortest)fail('Composition duration exceeds the shortest selected segment. Shorten durationSeconds or change offsets.');
 return {durationInFrames:requested,seconds:requested/manifest.fps,segmentFrames:Object.fromEntries(ids.map((id,i)=>[id,availableFrames[i]]))};
}
export function loadConfig({kind='Grid',format='16x9',selectedIds,allowMissing=false}={}){
 if(!['Grid','Matchup'].includes(kind))fail('kind must be Grid or Matchup.');
 if(!formats[format])fail(`Unknown format: ${format}`);
 const manifest=JSON.parse(readFileSync(resolve(videoDir,'manifest.json'),'utf8'));
 const summary=JSON.parse(readFileSync(resolve(benchmarkDir,'benchmark-summary.json'),'utf8'));
 const models=summary.models;const modelIds=models.map(m=>m.id);validateManifest(manifest,modelIds);
 const ids=kind==='Grid'?modelIds:(selectedIds??manifest.matchup);
 if(ids.length!==(kind==='Grid'?4:2)||new Set(ids).size!==ids.length||ids.some(id=>!modelIds.includes(id)))fail('Invalid model selection.');
 if(manifest.audioModel!==null&&!ids.includes(manifest.audioModel))fail('Selected audioModel is absent from this composition. Set audioModel to null or a selected ID.');
 const media={};const missing=[];
 for(const id of ids){
  const clip=manifest.clips.find(c=>c.id===id);const path=resolve(videoDir,clip.file);
  if(!existsSync(path)){missing.push(path);continue;}
  const result=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height,r_frame_rate,duration','-of','json',path],{encoding:'utf8'});
  if(result.error)fail(`ffprobe is required: ${result.error.message}`);
  if(result.status!==0)fail(`ffprobe failed for ${id}: ${result.stderr}`);
  const raw=JSON.parse(result.stdout);const stream=raw.streams?.find(s=>s.codec_type==='video');
  const streamDuration=Number(stream?.duration);
  const duration=Number.isFinite(streamDuration)&&streamDuration>0?streamDuration:Number(raw.format?.duration);
  if(!stream||!Number.isFinite(duration)||duration<=0)fail(`No valid video stream: ${id}`);
  media[id]={path,duration,raw};
 }
 if(missing.length&&!allowMissing)fail(`Missing original gameplay recordings:\n${missing.join('\n')}\nDrop the real MP4s at these paths. No substitutes will be rendered.`);
 const timeline=missing.length?{durationInFrames:Math.max(1,Math.floor((manifest.durationSeconds??30)*manifest.fps)),seconds:manifest.durationSeconds??30,segmentFrames:{}}:planTimeline(manifest,ids,Object.fromEntries(Object.entries(media).map(([id,m])=>[id,m.duration])));
 return {compositionId:`${kind}-${format}`,props:{manifest,models,selectedIds:ids,durationInFrames:timeline.durationInFrames,availableIds:Object.keys(media)},timeline,media,missing,publicDir:resolve(videoDir,'gameplay')};
}
export function parseArgs(argv){
 const opts={kind:'Grid',format:'16x9'};
 for(let i=0;i<argv.length;i++){
  const arg=argv[i];if(!['--kind','--format','--models','--output'].includes(arg))fail(`Unknown option: ${arg}`);
  const value=argv[++i];if(!value)fail(`Missing value for ${arg}`);
  if(arg==='--models')opts.selectedIds=value.split(',');else opts[arg.slice(2)]=value;
 }
 if(opts.selectedIds&&opts.kind!=='Matchup')fail('--models is only supported with --kind Matchup.');
 return opts;
}
