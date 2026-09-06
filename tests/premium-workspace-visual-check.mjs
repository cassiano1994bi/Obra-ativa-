import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startPreview, root} from './helpers/premium-workspace-preview.mjs';
const require = createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium} = require('playwright');
const {server, origin} = await startPreview();
const browser = await chromium.launch({headless:true, channel:'chrome'});
const context = await browser.newContext({serviceWorkers:'block', viewport:{width:1440,height:900}});
await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const output = path.join(root,'tmp/premium-workspace-qa');
await fs.mkdir(output,{recursive:true});
try {
  const label = process.argv[2] || 'after';
  await page.goto(origin+'/tests/premium-workspace-preview.html?app=1'+(label==='modern'?'&scenario=busy&weather=1':''));
  await page.waitForSelector('.obraativa-home-premium');
  await page.waitForTimeout(800);
  for (const [device,width,height] of [['desktop',1440,900],['tablet',1024,768],['phone',844,390],['small',667,375],['portrait',390,844]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(output,`${label}-${device}.png`)});
  }
  await page.setViewportSize({width:1440,height:900});
  const result = await page.evaluate(() => ({body:document.body.className, app:document.getElementById('app').className, view:document.getElementById('view').outerHTML, sidebar:document.querySelector('.side').outerHTML, errors:[]}));
  await fs.writeFile(path.join(output,`${label}-dom.json`),JSON.stringify({...result,errors},null,2));
  if (label !== 'before') {
    const modules=[];
    for (const module of ['works','planning','attendance','payments','financial','team','reports','permissions']) {
      await page.setViewportSize({width:1440,height:900});
      await page.evaluate(module=>{planningDate='2031-01-15';attendanceDate='2031-01-15';planningWorkId='OBRA-TESTE';go(module)},module);
      await page.waitForTimeout(250);
      modules.push(await page.evaluate(module=>({module,classes:[...new Set([...document.querySelectorAll('#view [class]')].map(e=>e.className))],html:document.getElementById('view').innerHTML}),module));
      await page.screenshot({path:path.join(output,`${label}-${module}-desktop.png`)});
      await page.setViewportSize({width:844,height:390});
      await page.waitForTimeout(250);
      await page.screenshot({path:path.join(output,`${label}-${module}-phone.png`)});
    }
    await fs.writeFile(path.join(output,`${label}-modules.json`),JSON.stringify({modules,errors},null,2));
    const guest = await context.newPage();
    await guest.goto(origin+'/tests/premium-workspace-preview.html?app=1&screen=login');
    await guest.waitForSelector('.obraativa-reception-shell');
    await guest.waitForSelector('#obraAtivaSplash',{state:'detached'});
    await guest.screenshot({path:path.join(output,'reference-login.png')});
    await guest.goto(origin+'/index.html?produto=1');
    await guest.waitForSelector('.oa-public-site');
    await guest.screenshot({path:path.join(output,'reference-public.png')});
    await guest.goto(origin+'/tests/premium-workspace-review.html');
    await guest.screenshot({path:path.join(output,'comparison.png')});
  }
  console.log(JSON.stringify({errors,output,body:result.body,view:result.view.slice(0,200)}));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
