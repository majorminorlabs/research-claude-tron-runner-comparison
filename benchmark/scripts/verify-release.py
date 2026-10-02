#!/usr/bin/env python3
"""Check the public manifest and independently recover the reported token/LOC metrics."""
from pathlib import Path
import hashlib,json,datetime,argparse
args=argparse.ArgumentParser();args.add_argument("--require-media",action="store_true");args=args.parse_args();missing_media=[]
B=Path(__file__).resolve().parents[1];ROOT=B.parent
manifest=json.loads((B/'release-manifest.json').read_text())
for file in manifest['files']:
 p=ROOT/file['path']
 if not p.exists() and file['delivery']=='github_release_asset_and_package' and not args.require_media:missing_media.append(file['path']);continue
 assert p.exists(),file['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==file['sha256'],file['path']
S=json.loads((B/'benchmark-summary.json').read_text());prompt=(B/'evidence/original-prompt.txt').read_text().rstrip('\n')
for m in S['models']:
 e=json.loads((B/f"evidence/{m['id']}-session.json").read_text());assert e['prompt']['normalized']==prompt
 seen=set();totals={k:0 for k in ['input_tokens','output_tokens','cache_creation_input_tokens','cache_read_input_tokens']}
 for record in e['usage_records']:
  assert record['message_id'] not in seen;seen.add(record['message_id'])
  for key in totals:totals[key]+=record['raw_usage'].get(key,0)
 assert all(m['tokens'][key]==v for key,v in totals.items())
 assert m['tokens']['total_tokens']==sum(totals.values())
 elapsed=(datetime.datetime.fromisoformat(m['run']['end_timestamp'].replace('Z','+00:00'))-datetime.datetime.fromisoformat(m['run']['start_timestamp'].replace('Z','+00:00'))).total_seconds()
 assert abs(elapsed-m['run']['wall_clock_build_seconds'])<.001
 src=ROOT/m['repo'];suffixes={'.ts','.js','.mjs','.css','.html','.svg'}
 prod=[p for p in (src/'src').rglob('*') if p.is_file() and p.suffix in suffixes]+[p for p in [src/'index.html',src/'style.css'] if p.exists()]
 loc=sum(len(p.read_text().splitlines()) for p in prod);assert loc==m['files']['loc_production'],(m['id'],loc)
 inv=json.loads((B/f"evidence/{m['id']}-inventory.json").read_text())['artifact_hashes']
 for p in src.rglob('*'):
  if p.is_file() and not set(p.relative_to(src).parts)&{'node_modules','dist','.git','test-results','playwright-report','.claude'} and p.name!='.DS_Store':assert inv[str(p.relative_to(src))]==hashlib.sha256(p.read_bytes()).hexdigest(),str(p)
print('Public file hashes, original game source hashes, prompts, request tokens, session intervals and production LOC verified for all four artifacts.')

if missing_media:print("Media not downloaded; source/evidence verification passed, media verification unavailable:",missing_media)
