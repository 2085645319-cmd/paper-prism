import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const base = process.env.PRISM_DEMO_URL || 'http://127.0.0.1:8788';
const dir = path.resolve('artifacts');
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
const apiRequests = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.url().includes('/api')) apiRequests.push(request.url()); });

const shot = async name => {
  await page.waitForTimeout(280);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  console.log('[demo-shots]', name);
};

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('demo-home');

await page.click('.composer .primary-button');
await page.waitForTimeout(2600);
await shot('demo-running');

await page.waitForSelector('.brief-editorial h2', { timeout: 30000 });
await page.waitForFunction(() => !document.querySelector('.run-strip'), { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await shot('demo-brief');
console.log('[demo-shots] title:', (await page.locator('.brief-editorial h2').innerText()).trim());

const gapSection = page.locator('.brief-section').filter({ hasText: '还没解决的问题' });
await gapSection.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
await page.waitForTimeout(300);
await shot('demo-gap-provenance');
console.log('[demo-shots] gap sources:', (await page.locator('.gap-provenance-summary').innerText()).replace(/\n/g, ' / '));

await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.locator('.tabs button').filter({ hasText: '文献' }).click();
await page.waitForTimeout(350);
await shot('demo-papers');

await page.locator('.view-switch button').filter({ hasText: '证据矩阵' }).click();
await page.waitForSelector('.matrix-table');
await page.waitForTimeout(300);
await shot('demo-matrix');
console.log('[demo-shots] matrix rows:', await page.locator('.matrix-table tbody tr').count());

await page.locator('.matrix-table tbody tr').nth(7).locator('.matrix-cell').nth(0).click();
await page.waitForSelector('.matrix-inspector');
await page.waitForTimeout(300);
await shot('demo-matrix-inspector');
await page.locator('.matrix-inspector .icon-button').click();
await page.waitForTimeout(250);

await page.locator('.matrix-paper').first().click();
await page.waitForSelector('.paper-drawer');
await page.waitForTimeout(350);
await shot('demo-drawer');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

await page.locator('.tabs button').filter({ hasText: '图谱' }).click();
await page.waitForTimeout(700);
await shot('demo-graph');

await page.locator('.tabs button').filter({ hasText: '轨迹' }).click();
await page.waitForTimeout(350);
await shot('demo-trace');

await page.locator('.tabs button').filter({ hasText: '简报' }).click();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(250);
await page.keyboard.press('Control+K');
await page.waitForSelector('.palette');
await page.waitForTimeout(350);
await shot('demo-palette');

console.log('[demo-shots] api requests:', apiRequests.length);
console.log('[demo-shots] console errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
