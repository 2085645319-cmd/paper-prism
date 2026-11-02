import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { CONFIG, DIST_DIR, hasLLM } from './config.mjs';
import { createJob, getJob } from './lib/jobs.mjs';
import { normalizeResearchOptions } from './lib/researchOptions.mjs';
import { runResearch } from './agents/orchestrator.mjs';
import { answerFollowUp } from './agents/chat.mjs';
import { translateAbstract } from './lib/translate.mjs';

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

const translateRate = new Map();
function allowTranslate(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const entries = (translateRate.get(ip) || []).filter(ts => ts > windowStart);
  if (entries.length >= 20) {
    translateRate.set(ip, entries);
    return false;
  }
  entries.push(now);
  translateRate.set(ip, entries);
  return true;
}

const chatRate = new Map();
function allowChat(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const entries = (chatRate.get(ip) || []).filter(ts => ts > windowStart);
  if (entries.length >= 20) {
    chatRate.set(ip, entries);
    return false;
  }
  entries.push(now);
  chatRate.set(ip, entries);
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

  const job = createJob(topic, normalizeResearchOptions(req.body?.options));
  res.status(202).json({ id: job.id, topic, options: job.options });
  runResearch(job).catch(error => job.fail(error));
});

app.get('/api/research/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '未找到该研究任务。' });
  res.json(job.snapshot());
});

app.get('/api/research/:id/events', (req, res) => {  const job = getJob(req.params.id);
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

app.post('/api/research/:id/chat', async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '当前研究已过期，请开启新对话。' });
  if (job.status !== 'complete' || !job.result) {
    return res.status(409).json({ error: '研究尚未完成，完成后即可继续对话。' });
  }
  const question = String(req.body?.question || '').replace(/\s+/g, ' ').trim();
  if (question.length < 2) return res.status(400).json({ error: '请输入你想继续追问的内容。' });
  if (question.length > 600) return res.status(400).json({ error: '问题请控制在 600 个字符以内。' });
  if (!allowChat(req.ip || 'local')) {
    return res.status(429).json({ error: '对话请求过于频繁，请稍后再试。' });
  }

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
  try {
    const reply = await answerFollowUp({ result: job.result, question, history });
    res.json(reply);
  } catch (error) {
    res.status(502).json({ error: error.message || '对话暂时不可用，请稍后再试。' });
  }
});

app.post('/api/translate', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (text.length < 40) {
    return res.status(400).json({ error: '摘要太短，无法翻译。' });
  }
  if (text.length > 7000) {
    return res.status(400).json({ error: '摘要太长，请打开原文阅读。' });
  }
  if (!allowTranslate(req.ip || 'local')) {
    return res.status(429).json({ error: '摘要翻译过于频繁，请稍后再试。' });
  }
  try {
    const translation = await translateAbstract(text);
    res.json({ translation });
  } catch (error) {
    const status = /未配置|not configured/i.test(String(error.message)) ? 503 : 502;
    res.status(status).json({ error: error.message || '摘要翻译失败。' });
  }
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
