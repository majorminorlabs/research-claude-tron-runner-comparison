import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig} from 'remotion';
import type {ComparisonProps, Metrics} from './types';
const ink='#edf1f1';const surface='#171e20';const muted='#bdc9cb';
const time=(v:number|string)=>typeof v==='number'?`${Math.floor(Math.round(v)/60)}m ${Math.round(v)%60}s`:'unavailable';
const tokens=(v:number|string)=>typeof v==='number'?`${(v/1e6).toFixed(2)}M`:'unavailable';
const strip=(m:Metrics)=>`Build ${time(m.run.wall_clock_build_seconds)}   ·   Total tokens ${tokens(m.tokens.total_tokens)}   ·   Effort ${Array.isArray(m.reasoning_effort)?m.reasoning_effort.join(', '):m.reasoning_effort}`;
export const Comparison:React.FC<ComparisonProps>=({manifest,models,selectedIds,availableIds})=>{
 const {width,height,fps,durationInFrames}=useVideoConfig();
 const portrait=height>width;const matchup=selectedIds.length===2;
 // Tall output uses full-width stacked gameplay panels to retain legibility.
 const columns=portrait?1:2;const rows=Math.ceil(selectedIds.length/columns);
 const pad=Math.round(width*0.015);const header=Math.round(height*(portrait?.038:.048));
 const footer=Math.round(height*(portrait?.028:.04));const gap=Math.round(width*.009);
 const panelWidth=(width-pad*2-gap*(columns-1))/columns;
 const panelHeight=(height-header-footer-pad*2-gap*(rows-1))/rows;
 const font=Math.max(16,Math.round(Math.min(panelWidth/36,panelHeight/14)));
 return <AbsoluteFill style={{backgroundColor:surface,color:ink,fontFamily:'Arial, sans-serif',padding:pad}}>
  <div style={{height:header,display:'flex',alignItems:'flex-start',justifyContent:'space-between',fontSize:Math.round(width*.013),fontWeight:600}}>
   <span style={{color:muted,fontWeight:400}}>{manifest.branding.subtitle} · {matchup?'Matchup':'Four models'}</span>
   <span style={{letterSpacing:'0.04em'}}>{manifest.branding.label}</span>
  </div>
  <div style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:`repeat(${columns}, minmax(0, 1fr))`,gridTemplateRows:`repeat(${rows}, minmax(0, 1fr))`,gap}}>
   {selectedIds.map(id=>{
    const m=models.find(x=>x.id===id)!;const c=manifest.clips.find(x=>x.id===id)!;
    const trim=Math.round(c.offsetSeconds*fps);const length=c.durationSeconds===null?durationInFrames:Math.min(durationInFrames,Math.floor(c.durationSeconds*fps));
    return <div key={id} style={{display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden',backgroundColor:'#0c1112'}}>
     <div style={{display:'flex',alignItems:'baseline',padding:`${Math.round(font*.36)}px ${font*.65}px`,fontSize:font*1.12,fontWeight:700,color:ink}}>{m.model}</div>
     <div style={{flex:1,minHeight:0,position:'relative'}}>
      {availableIds.includes(id)?<Sequence durationInFrames={length} layout="none"><OffthreadVideo src={staticFile(c.file.replace(/^gameplay\//,''))} trimBefore={trim} trimAfter={trim+length} muted={manifest.audioModel!==id} style={{width:'100%',height:'100%',objectFit:'contain'}}/></Sequence>:<AbsoluteFill style={{alignItems:'center',justifyContent:'center',fontSize:font,color:muted}}>Awaiting gameplay recording</AbsoluteFill>}
     </div>
     <div style={{padding:`${font*.4}px ${font*.65}px`,fontSize:font*.68,color:muted,lineHeight:1.45,whiteSpace:'normal'}}>{strip(m)}</div>
    </div>;
   })}
  </div>
  <div style={{height:footer,display:'flex',alignItems:'flex-end',fontSize:Math.max(11,Math.round(width*.009)),color:muted}}>
   Session time · Tokens include repeated cache reads · Original gameplay · {manifest.audioModel?`Audio: ${models.find(x=>x.id===manifest.audioModel)?.model}`:'Audio muted'}
  </div>
 </AbsoluteFill>;
};
