"""Run unchanged native tests with isolated ports and retained output/artifacts."""
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,time,os,signal,shutil,sys
B=Path(__file__).resolve().parents[1]
models=[('sonnet-5.5','sonnet55-runner',4471),('opus-5.5','opus55-runner',4472)]
if len(sys.argv)>1:models=[x for x in models if x[0]==sys.argv[1]]
for key,folder,port in models:
 p=B/'validation/workspaces'/folder;out=B/'validation'/key
 for name in ['e2e.json','e2e.log']:
  if (out/name).exists():shutil.copy2(out/name,out/name.replace('e2e.','e2e-attempt-1.'))
 if (p/'test-results').exists():shutil.copytree(p/'test-results',out/'e2e-attempt-1-artifacts',dirs_exist_ok=True)
 ext='ts' if key=='sonnet-5.5' else 'js'
 config=out/f'native-playwright.config.{ext}'
 url=f'http://127.0.0.1:{port}'
 config.write_text(f"import original from '../workspaces/{folder}/playwright.config.{ext}';\nexport default {{...original, testDir: {json.dumps(str(p/'tests/e2e'))}, outputDir: {json.dumps(str(out/'e2e-native-artifacts'))}, workers:1, retries:0, use:{{...original.use,baseURL:{json.dumps(url)}}}, webServer:{{...original.webServer,command:'npm run preview -- --port {port} --strictPort --host 127.0.0.1',cwd:{json.dumps(str(p))},url:{json.dumps(url)},reuseExistingServer:false}}}};\n")
 cmd=['npm','run','test:e2e','--','--config',str(config),'--workers=1','--retries=0'];start=datetime.now(timezone.utc).isoformat();t=time.perf_counter()
 with (out/'e2e-isolated.log').open('w') as f:
  proc=subprocess.Popen(cmd,cwd=p,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=proc.wait(timeout=1200)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGTERM);code=124;f.write('\nBenchmark timeout after 1200s.\n');proc.wait()
 result={'status':'passed' if code==0 else ('incomplete' if code==124 else 'failed'),'command':cmd,'started_at_utc':start,'elapsed_seconds':round(time.perf_counter()-t,3),'exit_code':code,'log':f'validation/{key}/e2e-isolated.log','config':str(config.relative_to(B)),'reason':'Native tests unchanged; benchmark wrapper isolates port and server ownership, uses already-built production bundle, one worker, zero retries, native browser flags.'}
 (out/'e2e-isolated.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
