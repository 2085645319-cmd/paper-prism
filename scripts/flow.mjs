import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const base = process.env.PRISM_URL || 'http://127.0.0.1:8790';
const topic = process.argv[2] || '多模态大模型的可信推理';
const dir = path.resolve('artifacts');
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.keyboard.press('Control+K');
await page.waitForSelector('.palette', { timeout: 5000 });
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(dir, 'palette.png') });
console.log('[flow] palette commands:', await page.locator('.palette-item').count());
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
await page.fill('#topic-input', topic);
await page.click('.composer .primary-button');
console.log('[flow] research started');
await page.waitForSelector('.brief-editorial h2', { timeout: 160_000 });
await page.waitForTimeout(1600);
const warnings = await page.locator('.inline-warning').count();
if (warnings) {
  console.log('[flow] heuristic fallback warnings:');
  for (const text of await page.locator('.trace-row.warning').allTextContents()) console.log('   ', text);
  await page.screenshot({ path: path.join(dir, 'results-heuristic.png') });
  await browser.close();
  process.exit(2);
}
await page.screenshot({ path: path.join(dir, 'results.png') });
await page.screenshot({ path: path.join(dir, 'results-full.png'), fullPage: true });
console.log('[flow] brief:', (await page.textContent('.brief-editorial h2'))?.trim());
console.log('[flow] pain points:', await page.locator('.pain-card').count());
console.log('[flow] themes:', await page.locator('.theme-card').count());

await page.click('.tabs button:nth-child(2)');
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(dir, 'papers.png') });
console.log('[flow] paper cards:', await page.locator('.paper-card').count());

await page.click('.paper-card');
await page.waitForSelector('.paper-drawer', { timeout: 5000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(dir, 'drawer.png') });
console.log('[flow] drawer:', (await page.textContent('.paper-drawer h2'))?.slice(0, 90));
await page.keyboard.press('Escape');

const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await page.click('.research-actions .secondary-button');
const download = await downloadPromise;
console.log('[flow] markdown export:', download ? download.suggestedFilename() : 'no download event');
await page.waitForTimeout(2800);

await page.click('.tabs button:nth-child(3)');
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(dir, 'graph.png') });

await page.keyboard.press('Control+K');
await page.waitForSelector('.palette', { timeout: 5000 });
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(dir, 'palette-research.png') });
console.log('[flow] research palette commands:', await page.locator('.palette-item').count());
await page.click('.palette-item:has-text("打开文献")');
await page.waitForTimeout(350);
console.log('[flow] palette action tab:', (await page.locator('.tabs button.active').innerText()).trim());
await page.keyboard.press('1');
await page.waitForTimeout(200);
console.log('[flow] keyboard tab:', (await page.locator('.tabs button.active').innerText()).trim());

console.log('[flow] console errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
