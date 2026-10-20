const {chromium}=require('C:/Users/JohnK/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let browser;
(async()=>{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:960,height:1100},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=path.resolve(__dirname,'../cube-toy-for-portfolio');
  await page.goto(pathToFileURL(path.join(base,'toy.html')).href);
  let f=page.frameLocator('#codex-visualization');
  await f.locator('#ce-next').waitFor();
  await f.locator('#ce-next').click();
  assert.equal(await f.locator('#ce-step').textContent(),'1');
  await page.goto(pathToFileURL(path.join(base,'portfolio-example.html')).href);
  f=page.frameLocator('#cube-toy').frameLocator('#codex-visualization');
  await f.locator('#ce-next').waitFor();
  await f.locator('#ce-reset').click();
  await f.locator('#ce-play').click();await page.waitForTimeout(1300);
  assert(Number(await f.locator('#ce-step').textContent())>=2,'Embedded autoplay should advance');
  await f.locator('#ce-play').click();
  for(const width of [960,360,320]){
    await page.setViewportSize({width,height:1100});await page.waitForTimeout(350);
    const dims=await page.evaluate(()=>{
      const e=document.getElementById('cube-toy');
      return {w:innerWidth,scroll:document.documentElement.scrollWidth,height:e.style.height,
        actual:e.getBoundingClientRect().height};
    });
    assert(dims.scroll<=dims.w+1,'No horizontal overflow at '+width);
    assert(dims.height && dims.height!=='1000px','Embed should resize to its content');
    const toyFrame=page.frames().find(x=>x.url().endsWith('/toy.html'));
    const child=await toyFrame.evaluate(()=>({height:document.documentElement.scrollHeight,viewport:innerHeight}));
    assert(child.height<=child.viewport+2,'No clipped content inside outer iframe: '+JSON.stringify(child));
    await page.screenshot({path:path.join(__dirname,`portfolio-${width}.png`),fullPage:true});
    console.log('Embedded layout',width,dims.height,'fits');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: standalone page, portfolio embed, autoplay, responsive automatic height, no runtime errors.');
  await browser.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
