import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const base = process.env.PRISM_DEMO_URL || 'http://127.0.0.1:8788';
const outDir = path.resolve('artifacts', 'demo-video');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--disable-features=Translate', '--no-first-run', '--force-device-scale-factor=1']
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: 1600, height: 900 } }
});
const page = await context.newPage();
page.on('console', message => { if (message.type() === 'error') console.log('[video] console error:', message.text()); });
page.on('pageerror', error => console.log('[video] page error:', error.message));

const sleep = ms => page.waitForTimeout(ms);

async function injectChrome() {
  await page.evaluate(() => {
    if (document.getElementById('video-caption')) return;
    const style = document.createElement('style');
    style.textContent = `
      #video-caption {
        position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%);
        z-index: 2147483647; max-width: 1260px; padding: 12px 22px;
        background: rgba(5, 7, 12, .9); color: #f4f5f7;
        border: 1px solid rgba(255,255,255,.14); border-left: 3px solid #7c86ff;
        border-radius: 8px; font: 500 24px/1.45 "Microsoft YaHei", sans-serif;
        letter-spacing: .2px; box-shadow: 0 18px 50px rgba(0,0,0,.35);
        text-align: center; pointer-events: none; opacity: 0; transition: opacity .25s;
      }
      #video-caption.show { opacity: 1; }
    `;
    document.head.appendChild(style);
    const caption = document.createElement('div');
    caption.id = 'video-caption';
    document.body.appendChild(caption);
  });
}

async function caption(text) {
  await page.evaluate(value => {
    const element = document.getElementById('video-caption');
    if (!element) return;
    element.textContent = value;
    element.classList.add('show');
  }, text);
}

async function hideCaption() {
  await page.evaluate(() => document.getElementById('video-caption')?.classList.remove('show'));
}

async function titleCard() {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:#010102;color:#f5f6f8;font-family:"Microsoft YaHei",sans-serif;}
    .wrap{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:22px;}
    .kicker{font-size:15px;letter-spacing:.34em;color:#8d95ff;font-weight:600;}
    h1{font-size:76px;margin:0;letter-spacing:-.04em;font-weight:700;}
    h2{font-size:28px;color:#aab0bf;font-weight:400;margin:0;}
    .line{width:74px;height:2px;background:#5e6ad2;margin:10px 0;}
    .meta{font-size:14px;color:#606777;letter-spacing:.12em;margin-top:26px;}
  </style></head><body><div class="wrap">
    <div class="kicker">2026 智启未来 · 体创万象</div>
    <h1>PRISM 文献棱镜</h1>
    <div class="line"></div>
    <h2>面向论文写作的多智能体文献研究助手</h2>
    <div class="meta">功能演示 · 约 1 分 40 秒</div>
  </div></body></html>`);
  await sleep(6000);
}

console.log('[video] title card');
await titleCard();

console.log('[video] home');
await page.goto(base, { waitUntil: 'networkidle' });
await sleep(1200);
await injectChrome();
await caption('从课题到可核验的证据地图，而不是一屏链接');
await sleep(6000);

console.log('[video] run');
await page.click('.composer .primary-button');
await sleep(2600);
await caption('三路 Scout 并行检索 Semantic Scholar / DOAJ / Crossref');
await sleep(5000);
await caption('Agent Mesh 实时显示 7 个智能体的状态与数据流');
await page.waitForSelector('.brief-editorial h2', { timeout: 30000 });
await page.waitForFunction(() => !document.querySelector('.run-strip'), { timeout: 20000 });
await sleep(1200);
await hideCaption();
await sleep(500);

console.log('[video] brief');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await caption('研究简报：主题、共识、分歧、未解问题与阅读路径');
await sleep(6500);
await page.evaluate(() => window.scrollTo({ top: 360, behavior: 'smooth' }));
await sleep(4500);

console.log('[video] gap provenance');
const gapSection = page.locator('.brief-section').filter({ hasText: '还没解决的问题' });
await gapSection.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
await sleep(600);
await caption('新的 Gap Provenance：每个缺口标明“作者自述 / 跨论文空白 / 模型推断”');
await sleep(7500);
await caption('作者自述必须给出逐字摘要原句，点击 P8 可回原文核对');
await sleep(4000);
const quote = page.locator('.gap-quote-cite').first();
if (await quote.count()) {
  await quote.click();
  await page.waitForSelector('.paper-drawer', { timeout: 5000 });
  await sleep(4500);
  await page.screenshot({ path: path.join(outDir, 'gap-quote-drawer.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}

console.log('[video] evidence matrix');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.locator('.tabs button').filter({ hasText: '文献' }).click();
await sleep(1800);
await caption('18 篇文献保留 DOI、原文入口和逐篇证据字段');
await sleep(4500);
await page.locator('.view-switch button').filter({ hasText: '证据矩阵' }).click();
await page.waitForSelector('.matrix-table');
await page.waitForTimeout(600);
await caption('证据矩阵：把 18 篇论文压成一张可核对的方法 / 发现 / 局限表');
await sleep(7500);
const quoteCell = page.locator('.matrix-table tbody tr').nth(7).locator('.matrix-cell').nth(0);
await quoteCell.click();
await page.waitForSelector('.matrix-inspector');
await page.waitForTimeout(500);
await caption('点击任意格子，右侧同时展示模型抽取与摘要中最接近的原句');
await sleep(6500);
await page.locator('.matrix-inspector .icon-button').click();
await page.waitForTimeout(400);

console.log('[video] graph and trace');
await page.locator('.tabs button').filter({ hasText: '图谱' }).click();
await sleep(1600);
await caption('知识图谱：课题、主题与论文的关系网络');
await sleep(5500);
await page.locator('.tabs button').filter({ hasText: '轨迹' }).click();
await sleep(1400);
await caption('执行轨迹与 token 预算：每一步都可回看');
await sleep(4500);

console.log('[video] close');
await page.locator('.tabs button').filter({ hasText: '简报' }).click();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await sleep(1200);
await caption('从课题到可核验的文献简报，把研究过程变得可见');
await sleep(5500);
await hideCaption();
await sleep(600);

const video = page.video();
await context.close();
await browser.close();
const raw = await video.path();
const target = path.resolve('artifacts', 'demo-video', 'demo.webm');
fs.copyFileSync(raw, target);
console.log('[video] raw', raw);
console.log('[video] copied', target);
