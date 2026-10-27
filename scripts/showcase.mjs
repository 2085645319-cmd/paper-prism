import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const base = process.env.PRISM_URL || 'http://127.0.0.1:8790';
const topic = process.argv[2] || '多模态大模型的可信推理';
const dir = path.resolve('artifacts');
fs.mkdirSync(dir, { recursive: true });

console.log('[showcase] launching Edge…');
const browser = await chromium.launch({
  channel: 'msedge',
  headless: false,
  args: ['--start-maximized', '--disable-features=Translate', '--no-first-run']
});
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();
page.on('console', message => {
  if (message.type() === 'error') console.log('[showcase] console error:', message.text());
});
page.on('pageerror', error => console.log('[showcase] page error:', error.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.bringToFront();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(dir, 'showcase-home.png') });
console.log('[showcase] home visible');

await page.fill('#topic-input', topic);
await page.waitForTimeout(300);
await page.click('.composer .primary-button');
console.log('[showcase] research started — watch the agent mesh');
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(dir, 'showcase-running.png') });

await page.waitForSelector('.brief-editorial h2', { timeout: 180_000 });
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(dir, 'showcase-result.png') });
console.log('[showcase] brief rendered:', (await page.textContent('.brief-editorial h2'))?.trim());
console.log('[showcase] pain points:', await page.locator('.pain-card').count());

await page.click('.tabs button:nth-child(3)');
await page.waitForTimeout(2400);
await page.screenshot({ path: path.join(dir, 'showcase-graph.png') });
console.log('[showcase] graph visible');

// Leave the browser open on the brief, with the full workspace visible.
await page.click('.tabs button:nth-child(1)');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
console.log('[showcase] browser left open on', page.url());
console.log('[showcase] READY');

// Keep the headed browser alive until this job is stopped.
await new Promise(() => {});
