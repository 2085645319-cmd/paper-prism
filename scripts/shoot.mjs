import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const base = process.env.PRISM_URL || 'http://127.0.0.1:8790';
const dir = path.resolve('artifacts');
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.screenshot({ path: path.join(dir, 'home.png') });
console.log('saved artifacts/home.png');
await browser.close();
