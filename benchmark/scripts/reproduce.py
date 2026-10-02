#!/usr/bin/env python3
"""Run the published harness in disposable copies, preserving release evidence."""
from pathlib import Path
from datetime import datetime,timezone
import argparse,json,shutil,subprocess
B=Path(__file__).resolve().parents[1];ROOT=B.parent
args=argparse.ArgumentParser();args.add_argument('--browser',action='store_true');args.add_argument('--native',action='store_true');args=args.parse_args()
run=B/'reproduction'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');RB=run/'benchmark';(RB/'scripts').mkdir(parents=True);(RB/'validation/workspaces').mkdir(parents=True)
shutil.copyfile(B/'benchmark-summary.json',RB/'benchmark-summary.json')
for name in ['validate.py','syntax-check.mjs','browser-smoke.mjs','browser-storage.mjs','native-e2e-isolated.py']:shutil.copyfile(B/'scripts'/name,RB/'scripts'/name)
models=json.loads((B/'benchmark-summary.json').read_text())['models']
for m in models:shutil.copytree(ROOT/m['repo'],RB/'validation/workspaces'/m['repo'],ignore=shutil.ignore_patterns('node_modules','dist','.git','test-results','playwright-report','.DS_Store','.claude'))
if args.browser or args.native:
 tools=B/'video/remotion/node_modules'
 if not tools.exists():raise SystemExit('Run npm --prefix benchmark/video/remotion ci first.')
 (RB/'video/remotion').mkdir(parents=True);(RB/'video/remotion/node_modules').symlink_to(tools.resolve(),target_is_directory=True)
for m in models:subprocess.run(['python3',str(RB/'scripts/validate.py'),m['id']],cwd=run,check=True)
if args.browser:
 for name in ['browser-smoke.mjs','browser-storage.mjs']:subprocess.run(['node',str(RB/'scripts'/name)],cwd=run,check=True)
if args.native:subprocess.run(['python3',str(RB/'scripts/native-e2e-isolated.py')],cwd=run,check=True)
# validate.py records failures in JSON even when its wrapper completes.
failed=[]
for m in models:
 c=json.loads((RB/'validation'/m['id']/'checks.json').read_text())
 failed.extend(f"{m['id']}/{k}" for k,v in c.items() if v.get('status')=='failed')
if args.browser:
 for m in models:
  for name in ['browser-smoke.json','restricted-storage.json']:
   data=json.loads((RB/'validation'/m['id']/name).read_text())
   if data.get('status')=='failed':failed.append(m['id']+'/'+name)
if args.native:
 for m in models:
  file=RB/'validation'/m['id']/'e2e-isolated.json'
  if file.exists() and json.loads(file.read_text()).get('status')!='passed':failed.append(m['id']+'/native-e2e')
print('Reproduction logs:',run)
print('Failed declared checks:',failed)
if failed:raise SystemExit(1)
