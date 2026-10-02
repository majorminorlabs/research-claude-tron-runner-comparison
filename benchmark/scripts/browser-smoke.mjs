import {chromium} from '../video/remotion/node_modules/@playwright/test/index.mjs';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const B=resolve(fileURLToPath(new URL('..',import.meta.url)));
const models=[['sonnet-5','sonnet5-runner','#overlay-button'],['sonnet-5.5','sonnet55-runner','#btn-play'],['opus-5','opus5-runner','#startBtn'],['opus-5.5','opus55-runner','#btn-start']];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const [index,[id,repo,start]] of models.entries()){
 const port=4380+index;const root=join(B,'validation/workspaces',repo,id==='sonnet-5'?'':'dist');
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 const result={browser:'Installed Google Chrome, headless, SwiftShader',query:'?debug&seed=35 (only honored by Sonnet 5.5 / Opus 5.5)',cases:[]};
 try{
  for(let i=0;i<40;i++){try{await fetch(`http://127.0.0.1:${port}`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
  for(const [label,viewport,touch] of [['desktop',{width:1280,height:720},false],['portrait',{width:390,height:844},true]]){
   const context=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:1});const page=await context.newPage();
   const errors=[],warnings=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
   page.on('requestfailed',r=>requests.push({url:r.url(),failure:r.failure()}));page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),http_status:r.status()});});
   const checks={};const observations={};
   try{
    await page.goto(`http://127.0.0.1:${port}/?debug&seed=35`,{waitUntil:'networkidle'});
    checks.start_button_visible=await page.locator(start).isVisible();
    await page.waitForTimeout(300);await page.screenshot({path:join(B,'validation',id,`${label}-title.png`)});
    const canvas=await page.locator('canvas').first().evaluate(c=>({width:c.width,height:c.height,rect:{width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}}));
    observations.canvas=canvas;checks.canvas_nonzero=canvas.width>0&&canvas.height>0;
    checks.no_horizontal_overflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
    await page.locator(start).click();
    if(id==='sonnet-5.5')await page.waitForFunction(()=>window.__gridrun?.phase==='playing',{},{timeout:20000});
    await page.waitForTimeout(250);
    const state=()=>page.evaluate(()=>{
     if(window.__tronRunnerDebug){const s=window.__tronRunnerDebug.getState();return {phase:s.mode,score:s.score,lane:s.lane,jumping:s.action==='jump',sliding:s.action==='slide',distance:s.distance};}
     if(window.__gridrun){const g=window.__gridrun.game;return {phase:window.__gridrun.phase,score:g?.score,lane:g?.player.lane,jumping:g?.player.y>0,sliding:g?.player.sliding,distance:g?.distance};}
     if(window.__gridRunner){const s=window.__gridRunner.snapshot();return {...s,jumping:s.y>0};}
     return {phase:document.querySelector('#pauseScreen')?.hidden===false?'paused':document.querySelector('#overScreen')?.hidden===false?'over':'playing',score:Number(document.querySelector('#score')?.textContent.replace(/,/g,''))};
    });
    const a=await state();await page.waitForTimeout(300);const b=await state();observations.start_state=b;checks.score_advances=b.score>a.score;
    await page.keyboard.press('ArrowLeft');await page.waitForTimeout(180);const left=await state();
    checks.keyboard_left=id==='opus-5'?'unavailable: no public state hook':left.lane===0;
    await page.keyboard.press('ArrowRight');await page.waitForTimeout(180);checks.keyboard_right=id==='opus-5'?'unavailable: no public state hook':(await state()).lane===1;
    await page.keyboard.press('ArrowUp');await page.waitForTimeout(100);checks.jump=id==='opus-5'?'unavailable: no public state hook':(await state()).jumping===true;
    await page.waitForTimeout(850);await page.keyboard.press('ArrowDown');await page.waitForTimeout(100);checks.slide=id==='opus-5'?'unavailable: no public state hook':(await state()).sliding===true;
    await page.screenshot({path:join(B,'validation',id,`${label}-playing.png`)});
    await page.keyboard.press('KeyP');await page.waitForTimeout(100);const p=await state();await page.waitForTimeout(250);const q=await state();
    checks.pause=p.phase==='paused'&&q.phase==='paused'&&p.score===q.score;
    await page.keyboard.press('KeyP');if(id==='sonnet-5.5')await page.waitForFunction(()=>window.__gridrun?.phase==='playing',{},{timeout:20000});
    checks.resume=(await state()).phase==='playing';
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(100);observations.blur_phase=(await state()).phase;
    checks.no_uncaught_or_console_errors=errors.length===0;
   }catch(e){errors.push(`Harness: ${e.message}`);checks.harness_completed=false;}
   result.cases.push({viewport:label,dimensions:viewport,touch_emulated:touch,checks,observations,errors,warnings,failed_requests:requests});await context.close();
  }
 }finally{server.kill();}
 result.status=result.cases.every(c=>Object.values(c.checks).every(x=>x!==false)&&c.errors.length===0)?'passed':'failed';
 await writeFile(join(B,'validation',id,'browser-smoke.json'),JSON.stringify(result,null,2)+'\n');console.log(id,result.status,JSON.stringify(result.cases.map(c=>({viewport:c.viewport,checks:c.checks,errors:c.errors,warnings:c.warnings,failed_requests:c.failed_requests}))));
}
await browser.close();
