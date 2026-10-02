import {chromium} from '../video/remotion/node_modules/@playwright/test/index.mjs';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const B=resolve(fileURLToPath(new URL('..',import.meta.url)));
const models=[['sonnet-5','sonnet5-runner','#overlay-button'],['sonnet-5.5','sonnet55-runner','#btn-play'],['opus-5','opus5-runner','#startBtn'],['opus-5.5','opus55-runner','#btn-start']];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const [index,[id,repo,start]] of models.entries()){
 const port=4390+index;const root=join(B,'validation/workspaces',repo,id==='sonnet-5'?'':'dist');
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 try{
  for(let i=0;i<40;i++){try{await fetch(`http://127.0.0.1:${port}`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('benchmark: localStorage blocked');}}));
  await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1500);
  const result={scenario:'localStorage getter throws, representing denied browser storage',errors,start_button_visible:await page.locator(start).isVisible(),status:errors.length===0?'passed':'failed'};
  await writeFile(join(B,'validation',id,'restricted-storage.json'),JSON.stringify(result,null,2)+'\n');console.log(id,JSON.stringify(result));await context.close();
 }finally{server.kill();}
}
await browser.close();
