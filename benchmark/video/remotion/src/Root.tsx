import React from 'react';
import {Composition, Folder} from 'remotion';
import {Comparison} from './Comparison';
import rawManifest from '../../manifest.json';
import summary from '../../../benchmark-summary.json';
import type {ComparisonProps, Manifest, Metrics} from './types';
const manifest=rawManifest as Manifest;
const models=summary.models as unknown as Metrics[];
const presets=[['16x9',1920,1080],['4x3',1600,1200],['1x1',1440,1440],['9x16',1080,1920]] as const;
export const Root:React.FC=()=> <>
 {['Grid','Matchup'].map(kind=><Folder key={kind} name={kind}>{presets.map(([ratio,width,height])=>{
  const selectedIds=kind==='Grid'?models.map(m=>m.id):manifest.matchup;
  const props:ComparisonProps={manifest,models,selectedIds,durationInFrames:Math.round((manifest.durationSeconds??30)*manifest.fps),availableIds:[]};
  return <Composition key={ratio} id={`${kind}-${ratio}`} component={Comparison} width={width} height={height} fps={manifest.fps} durationInFrames={props.durationInFrames} defaultProps={props}
   calculateMetadata={({props,isRendering})=>{const ids=kind==='Grid'?props.models.map(m=>m.id):(props.selectedIds.length===2?props.selectedIds:props.manifest.matchup);if(isRendering&&!props.layoutQa&&ids.some(id=>!props.availableIds.includes(id)))throw new Error('Original gameplay recordings are required for export. Use the supplied render script.');return {durationInFrames:props.durationsByKind?.[kind]??props.durationInFrames,fps:props.manifest.fps,props:{...props,selectedIds:ids}};}}/>;
 })}</Folder>)}
</>;
