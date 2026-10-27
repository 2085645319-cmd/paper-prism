import fs from 'node:fs';
import path from 'node:path';

const base = process.env.PRISM_URL || 'http://127.0.0.1:8790';
const topic = process.argv[2] || '多模态大模型的可信推理';

const started = Date.now();
const response = await fetch(`${base}/api/research`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic })
});
if (!response.ok) {
  console.error('start failed', response.status, await response.text());
  process.exit(1);
}
const { id } = await response.json();
console.log(`[smoke] job ${id} · ${topic}`);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 180_000);
const stream = await fetch(`${base}/api/research/${id}/events`, { signal: controller.signal });
if (!stream.ok) {
  console.error('events failed', stream.status);
  process.exit(1);
}

const reader = stream.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let final = null;
let failed = null;

while (!final && !failed) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const frames = buffer.split('\n\n');
  buffer = frames.pop() || '';
  for (const frame of frames) {
    const dataLines = frame.split('\n').filter(line => line.startsWith('data: '));
    for (const line of dataLines) {
      const event = JSON.parse(line.slice(6));
      if (event.type === 'stage') {
        console.log(`  ${event.id.padEnd(12)} ${String(event.status).padEnd(8)} ${event.detail || ''}`);
      } else if (event.type === 'papers') {
        console.log(`  corpus       ${event.papers.length} papers from ${event.sources.filter(s => s.status === 'done').length} sources`);
      } else if (event.type === 'warning') {
        console.log(`  warning      ${event.message}`);
      } else if (event.type === 'done') {
        final = event.result;
      } else if (event.type === 'error') {
        failed = event.message;
      }
    }
  }
}
clearTimeout(timeout);

if (failed) {
  console.error('[smoke] failed:', failed);
  process.exit(1);
}
if (!final) {
  console.error('[smoke] stream ended without a result');
  process.exit(1);
}

const dir = path.resolve('artifacts');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'smoke-result.json'), JSON.stringify(final, null, 2));

console.log('\n[smoke] result');
console.log('  plan queries:', final.plan.queries.length, '| field:', final.plan.field);
console.log('  papers:', final.papers.length, '| sources:', final.sources.map(s => `${s.name}:${s.status}/${s.count}`).join(' '));
console.log('  themes:', final.brief.keyThemes.length, '| pain points:', final.brief.painPoints.length, '| reading path:', final.brief.readingPath.length);
console.log('  confidence:', final.quality.confidence, '| mode:', final.quality.mode, '| duration:', (final.meta.durationMs / 1000).toFixed(1) + 's');
console.log('  title:', final.brief.title);
console.log('  standfirst:', final.brief.standfirst);
console.log('  gaps:', final.brief.painPoints.map(p => p.title).join(' · '));
console.log('  saved: artifacts/smoke-result.json');
controller.abort();
process.exit(0);
