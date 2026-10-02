export type Clip = {id:string; file:string; offsetSeconds:number; durationSeconds:number|null};
export type Metrics = {id:string; model:string; model_id:string; reasoning_effort:string|string[]; run:{wall_clock_build_seconds:number|string}; tokens:{total_tokens:number|string}};
export type Manifest = {schemaVersion:number; fps:number; durationSeconds:number|null; audioModel:string|null; branding:{label:string; subtitle:string}; clips:Clip[]; matchup:string[]};
export type ComparisonProps = {manifest:Manifest; models:Metrics[]; selectedIds:string[]; durationInFrames:number; availableIds:string[]; durationsByKind?:Record<string,number>; layoutQa?:boolean};
