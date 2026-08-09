import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('source/public/recordings');
const output = path.join(outputDir, 'product-flow.webm');
await fs.mkdir(outputDir, {recursive: true});
await fs.rm(output, {force: true});

const browser = await chromium.launch({headless: true, executablePath: chrome});
const context = await browser.newContext({
  viewport: {width: 1920, height: 1080},
  deviceScaleFactor: 1,
  recordVideo: {dir: outputDir, size: {width: 1920, height: 1080}},
});
const page = await context.newPage();

const demoPulse = {
  memoryCount: 24,
  analyzedMemoryCount: 24,
  pendingAnalysisCount: 0,
  failedAnalysisCount: 0,
  analysisCoverage: 100,
  timezone: 'America/Toronto',
  moods: [
    {label: 'excited', count: 8, percentage: 33},
    {label: 'happy', count: 6, percentage: 25},
    {label: 'emotional', count: 4, percentage: 17},
    {label: 'determined', count: 4, percentage: 17},
    {label: 'loved', count: 2, percentage: 8},
  ],
  themes: [
    {label: 'friendship', count: 14},
    {label: 'achievement', count: 11},
    {label: 'coding', count: 9},
    {label: 'creativity', count: 8},
    {label: 'celebration', count: 7},
    {label: 'teamwork', count: 6},
  ],
  visualTags: [
    {label: 'photos', count: 18},
    {label: 'drawings', count: 12},
    {label: 'messages', count: 10},
    {label: 'postcards', count: 8},
  ],
  timeline: [
    {bucket: '2026-08-09T14:00:00.000Z', count: 1},
    {bucket: '2026-08-09T15:00:00.000Z', count: 2},
    {bucket: '2026-08-09T16:00:00.000Z', count: 3},
    {bucket: '2026-08-09T17:00:00.000Z', count: 2},
    {bucket: '2026-08-09T18:00:00.000Z', count: 5},
    {bucket: '2026-08-09T19:00:00.000Z', count: 4},
    {bucket: '2026-08-09T20:00:00.000Z', count: 6},
    {bucket: '2026-08-09T21:00:00.000Z', count: 1},
  ],
  peak: {bucket: '2026-08-09T20:00:00.000Z', count: 6},
  story: 'The room buzzed with excitement as friends built, created, and celebrated together. Teamwork carried the night, while photos, sketches, and heartfelt messages captured every perspective.',
};

await page.route(/\/api\/v1\/events\/[^/]+\/pulse(?:\?.*)?$/, (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({pulse: demoPulse}),
}));

await page.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<span></span>';
    Object.assign(cursor.style, {
      position: 'fixed', left: '0', top: '0', width: '34px', height: '34px',
      border: '4px solid #f7eedc', borderRadius: '50%', zIndex: '2147483647',
      pointerEvents: 'none', transform: 'translate(950px, 540px)',
      transition: 'transform 650ms cubic-bezier(.22,.85,.31,1), width 120ms, height 120ms',
      boxShadow: '0 0 0 3px #2357d8, 0 6px 16px rgba(0,0,0,.42)',
    });
    cursor.querySelector('span').style.cssText = 'position:absolute;left:50%;top:50%;width:7px;height:7px;background:#f6c542;border-radius:50%;transform:translate(-50%,-50%)';
    document.body.appendChild(cursor);
  });
});

const wait = (ms) => page.waitForTimeout(ms);
const move = async (locator, pause = 700) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Target is not visible: ${await locator.toString()}`);
  await page.evaluate(({x,y}) => {
    const cursor = document.querySelector('#demo-cursor');
    if (cursor) cursor.style.transform = `translate(${x - 17}px, ${y - 17}px)`;
  }, {x: box.x + box.width / 2, y: box.y + box.height / 2});
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {steps: 18});
  await wait(pause);
};
const click = async (locator, after = 900) => {
  await move(locator);
  await page.evaluate(() => { const c=document.querySelector('#demo-cursor'); if(c){c.style.width='25px';c.style.height='25px';setTimeout(()=>{c.style.width='34px';c.style.height='34px'},140);} });
  await locator.click();
  await wait(after);
};
const type = async (locator, value, after = 500) => {
  await move(locator, 450);
  await locator.fill('');
  await locator.pressSequentially(value, {delay: 70});
  await wait(after);
};

await page.goto('http://127.0.0.1:3100', {waitUntil: 'networkidle'});
await wait(1800);

await click(page.getByRole('button', {name: 'CREATE CAPSULE', exact: true}), 1200);
await type(page.locator('#setup-event-name'), 'SummerHacks Afterglow');
await type(page.locator('#setup-description'), 'One night. Every perspective.');
await click(page.locator('[data-setup-capacity="100"]'), 400);
await click(page.locator('[data-setup-accent="mint"]'), 500);
await click(page.locator('[data-setup-sticker="tech"]'), 700);
await click(page.locator('#capsule-setup-form button[type="submit"]'), 2300);

await page.locator('#event-screen.is-active').waitFor();
await click(page.locator('[data-open="invite"]'), 1800);
await click(page.locator('.invite-modal .close-button[data-close="invite"]'), 700);
await click(page.locator('[data-add-memory]'), 900);

await move(page.locator('.upload-polaroid'), 450);
await page.locator('#photo-input').setInputFiles(path.resolve('../assets/photo-concert.png'));
await wait(1100);
await type(page.locator('#memory-author'), 'Maya');
await type(page.locator('#memory-message'), 'We made it — together!');
await click(page.locator('[data-mood]').nth(7), 600);
await click(page.locator('[data-next="draw"]'), 1000);

const canvas = page.locator('#drawing-canvas');
await move(canvas, 400);
const box = await canvas.boundingBox();
if (box) {
  const points = [[.27,.55],[.36,.42],[.46,.57],[.58,.38],[.70,.54],[.77,.43]];
  await page.mouse.move(box.x+box.width*points[0][0], box.y+box.height*points[0][1]);
  await page.mouse.down();
  for (const [x,y] of points.slice(1)) {
    await page.mouse.move(box.x+box.width*x, box.y+box.height*y,{steps:9});
    await page.evaluate(({x,y}) => {const c=document.querySelector('#demo-cursor');if(c)c.style.transform=`translate(${x-17}px,${y-17}px)`;},{x:box.x+box.width*x,y:box.y+box.height*y});
  }
  await page.mouse.up();
}
await wait(700);
await click(page.locator('.draw-modal [data-send="true"]').first(), 2600);

await click(page.locator('[data-open="viewer"]'), 1400);
await click(page.locator('[data-rip-memory]'), 2200);
await click(page.locator('.viewer-close[data-close="viewer"]'), 800);
await click(page.locator('[data-nav="pulse"]'), 1000);
await page.evaluate(() => document.querySelector('#toast')?.classList.remove('is-visible'));
await wait(3200);

const video = page.video();
await context.close();
await browser.close();
const recorded = await video.path();
await fs.rename(recorded, output);
console.log(output);
