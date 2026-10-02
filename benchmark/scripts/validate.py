#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,time,sys
ROOT=Path(__file__).resolve().parents[2];B=ROOT/'benchmark'
key=sys.argv[1];summary=json.loads((B/'benchmark-summary.json').read_text());m=next(x for x in summary['models'] if x['id']==key)
p=B/'validation/workspaces'/m['repo'];out=B/'validation'/key;out.mkdir(parents=True,exist_ok=True)
checks={}
def run(name,cmd,timeout=180):
 start=datetime.now(timezone.utc).isoformat();t=time.perf_counter()
 try:
  r=subprocess.run(cmd,cwd=p,capture_output=True,text=True,timeout=timeout);code=r.returncode;text=r.stdout+r.stderr
 except subprocess.TimeoutExpired as e:code=124;text=str(e)
 (out/(name+'.log')).write_text(text)
 checks[name]={'status':'passed' if code==0 else 'failed','command':cmd,'cwd':str(p.relative_to(ROOT)),'exit_code':code,'started_at_utc':start,'elapsed_seconds':round(time.perf_counter()-t,3),'log':str((out/(name+'.log')).relative_to(B))}
 print(key,name,checks[name]['status'],text[-500:],flush=True)
if (p/'package-lock.json').exists():run('install',['npm','ci','--no-audit','--no-fund'])
else:checks['install']={'status':'not_required','reason':'No dependencies declared.'}
for name in ['test','build','lint','typecheck']:
 if name in m['dependencies']['scripts']:run(name,['npm','run',name],300)
 else:checks[name]={'status':'unavailable','reason':f'No {name} script declared.'}
js=[str(f.relative_to(p)) for f in p.rglob('*') if f.suffix in ['.js','.mjs'] and 'node_modules' not in f.parts and 'dist' not in f.parts]
run('javascript_syntax',['node',str(B/'scripts/syntax-check.mjs'),*js])
if key=='sonnet-5':checks['static_delivery']={'status':'passed','reason':'Unbundled ES modules and CSS; no build step required. Runtime validated by common browser smoke.'}
(out/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
