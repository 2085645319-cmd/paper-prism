import { chromium } from 'playwright-core';
import path from 'node:path';

const base = process.env.PRISM_URL || 'http://127.0.0.1:8790';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth
}));
await page.screenshot({ path: path.resolve('artifacts/mobile-home.png'), fullPage: true });

await page.keyboard.press('Control+K');
await page.waitForSelector('.palette', { timeout: 5000 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.resolve('artifacts/mobile-palette.png') });
console.log('mobile overflow:', JSON.stringify(overflow), 'palette commands:', await page.locator('.palette-item').count());
await browser.close();
