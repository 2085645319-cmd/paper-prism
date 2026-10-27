import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { CONFIG, DIST_DIR, hasLLM } from './config.mjs';
import { createJob, getJob } from './lib/jobs.mjs';
import { runResearch } from './agents/orchestrator.mjs';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

const rate = new Map();
function allow(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const entries = (rate.get(ip) || []).filter(ts => ts > windowStart);
  if (entries.length >= 12) {
    rate.set(ip, entries);
    return false;
  }
  entries.push(now);
  rate.set(ip, entries);
  return true;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    llm: hasLLM(),
    model: CONFIG.deepseekModel,
    sources: ['Semantic Scholar', 'DOAJ', 'Crossref'],
    version: '0.2.0'
  });
});

app.post('/api/research', (req, res) => {
  const topic = String(req.body?.topic || '').replace(/\s+/g, ' ').trim();
  if (topic.length < 3) {
    return res.status(400).json({ error: '请输入至少 3 个字符的研究课题。' });
  }
  if (topic.length > 240) {
    return res.status(400).json({ error: '课题请控制在 240 个字符以内。' });
  }
  if (!allow(req.ip || 'local')) {
    return res.status(429).json({ error: '研究请求过于频繁，请稍后再试。' });
  }

  const job = createJob(topic);
  res.status(202).json({ id: job.id, topic });
  runResearch(job).catch(error => job.fail(error));
});

app.get('/api/research/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '未找到该研究任务。' });
  res.json(job.snapshot());
});

app.get('/api/research/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '未找到该研究任务。' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 1500\n\n');

  const send = event => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  for (const event of job.events) send(event);

  const unsubscribe = job.subscribe(send);
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '接口不存在。' });
});

if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send('PRISM 接口正在运行。请先执行 `npm run build` 构建前端，或运行 `npm run dev:client` 启动开发客户端。');
  });
}

app.use((error, _req, res, _next) => {
  console.error('[prism]', error);
  res.status(500).json({ error: '服务器出现异常，请稍后重试。' });
});

app.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`[prism] http://${CONFIG.host}:${CONFIG.port}`);
  console.log(`[prism] model=${CONFIG.deepseekModel} llm=${hasLLM() ? 'ready' : 'missing key (heuristic mode)'}`);
});
