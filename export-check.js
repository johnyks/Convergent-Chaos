/* Optional browser QA; the website itself has no dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function playwright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright'];
  if (process.platform === 'win32' && process.env.USERPROFILE) {
    candidates.push(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  }
  for (const candidate of candidates.filter(Boolean)) {
    try { return require(candidate); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('Install Playwright for development QA, or set PLAYWRIGHT_MODULE_PATH. The website has no runtime dependencies.');
}
const output = path.join(__dirname, 'test-results');
const url = file => process.env.PREVIEW_URL ? new URL(file, process.env.PREVIEW_URL).href : pathToFileURL(path.join(__dirname, file)).href;
let browser;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const { chromium } = playwright();
  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  await page.goto(url('index.html'));
  await page.locator('#fixed-point-toy').scrollIntoViewIfNeeded();
  const toy = page.frameLocator('#fixed-point-toy');
  await toy.locator('#step').waitFor();
  await toy.locator('#step').click();
  assert.equal(await toy.locator('#iteration').textContent(), '1');
  assert.equal(await toy.locator('#current').textContent(), Math.cos(.2).toFixed(8));
  const readResidual = async frame => Number((await frame.locator('#residual').textContent()).replace('−', '-'));
  assert(Math.abs(await readResidual(toy) - Math.abs(Math.cos(Math.cos(.2)) - Math.cos(.2))) < .001);
  await toy.locator('#reset').click();
  assert.equal(await toy.locator('#iteration').textContent(), '0');
  await toy.locator('#guess').fill('1.5');
  await toy.locator('.guess-submit').click();
  assert.equal(await toy.locator('#iteration').textContent(), '0');
  assert.equal(await toy.locator('#initial').textContent(), '0.200000');
  await toy.locator('#guess').fill('0.5');
  await toy.locator('#speed').selectOption('65');
  await toy.locator('.guess-submit').click();
  await page.waitForTimeout(260);
  await toy.locator('#run').click();
  const pausedIteration = await toy.locator('#iteration').textContent();
  await page.waitForTimeout(250);
  assert.equal(await toy.locator('#iteration').textContent(), pausedIteration, 'Pause must freeze the iteration');
  await toy.locator('#step').click();
  assert.equal(Number(await toy.locator('#iteration').textContent()), Number(pausedIteration) + 1);
  await toy.locator('#run').click();
  await toy.locator('#run:disabled').waitFor({ timeout: 12000 });
  assert(await readResidual(toy) <= 1e-6, 'The actual fixed-point residual must meet tolerance');
  assert.equal(await toy.locator('#iteration').textContent(), '33', 'Expected recurrence count for x0=.5');
  assert.equal(await toy.locator('#history tr').count(), 34);

  for (const width of [1440, 960, 768, 390, 360, 320]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(250);
    const offscreenFrame = page.frames().find(frame => frame.url().includes('fixed-point.html'));
    const offscreen = await offscreenFrame.evaluate(() => ({ height: innerHeight, content: document.documentElement.scrollHeight }));
    assert(offscreen.content <= offscreen.height + 2, `Offscreen iframe resize at ${width}: ${JSON.stringify(offscreen)}`);
    await page.locator('#fixed-point-toy').scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    const dims = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert(dims.scroll <= dims.width + 1, `Homepage horizontal overflow at ${width}: ${JSON.stringify(dims)}`);
    const toyFrame = page.frames().find(frame => frame.url().includes('fixed-point.html'));
    const child = await toyFrame.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, height: innerHeight, content: document.documentElement.scrollHeight }));
    assert(child.scroll <= child.width + 1, `Toy horizontal overflow at ${width}: ${JSON.stringify(child)}`);
    assert(child.content <= child.height + 2, `Clipped iframe at ${width}: ${JSON.stringify(child)}`);
    await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true });
    if (width === 1440 || width === 390) await page.locator('.toy-workspace').screenshot({ path: path.join(output, `toy-${width}.png`) });
    console.log(`PASS responsive layout: ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(200);
  const beforeHeight = Number(await page.locator('#fixed-point-toy').getAttribute('height'));
  await toy.locator('#history-details summary').click();
  await page.waitForTimeout(200);
  const afterHeight = Number(await page.locator('#fixed-point-toy').getAttribute('height'));
  assert(afterHeight > beforeHeight + 50, 'Iframe should grow when history is opened');
  await toy.locator('#history-details summary').click();
  await page.waitForTimeout(200);
  assert(Number(await page.locator('#fixed-point-toy').getAttribute('height')) < afterHeight - 50, 'Iframe should shrink when history is closed');

  for (const file of ['index.html', 'resume.html', 'portfolio-example.html', 'toys/fixed-point.html']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|data:)/.test(target)) continue;
      const local = target.split(/[?#]/)[0];
      assert(fs.existsSync(path.resolve(__dirname, path.dirname(file), local)), `Broken local link in ${file}: ${target}`);
    }
  }
  await page.goto(url('resume.html'));
  assert.equal(await page.locator('h1').count(), 1);
  assert(await page.locator('#print-resume').isVisible());
  await page.setViewportSize({ width: 320, height: 1000 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Résumé should fit a phone');
  await page.screenshot({ path: path.join(output, 'resume-mobile.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(output, 'resume-print.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url('index.html'));
  await page.locator('#flow-motion').click();
  assert.match(await page.locator('#flow-motion').textContent(), /Resume/);
  await page.locator('#flow-motion').click();
  assert.match(await page.locator('#flow-motion').textContent(), /Pause/);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(output, 'hero-desktop.png') });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, 'hero-mobile.png') });
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('PASS: numerical convergence, step/pause/reset, validation, iframe growth/shrink, local links, résumé, print export and motion control.');
  await browser.close();
})().catch(async error => {
  console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
