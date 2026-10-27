import { searchSemanticScholar } from '../providers/semanticscholar.mjs';
import { searchDoaj } from '../providers/doaj.mjs';
import { searchCrossref } from '../providers/crossref.mjs';

const now = () => Date.now();

const SOURCES = [
  {
    id: 'semanticscholar',
    name: 'Semantic Scholar',
    role: 'Citation-aware research graph',
    run: query => searchSemanticScholar(query, 30)
  },
  {
    id: 'doaj',
    name: 'DOAJ',
    role: 'Open-access journals',
    run: query => searchDoaj(query, 10)
  },
  {
    id: 'crossref',
    name: 'Crossref',
    role: 'DOI metadata backbone',
    run: query => searchCrossref(query, 10)
  }
];

async function runSource(source, plan, job) {
  const started = now();
  const query = plan.queries[0] || plan.topic_en;
  job.emit('stage', {
    id: source.id,
    status: 'running',
    detail: `正在检索 ${source.name} · "${query.slice(0, 64)}"`
  });

  try {
    const records = await source.run(query);
    const ms = now() - started;
    job.emit('stage', {
      id: source.id,
      status: 'done',
      detail: `${records.length} 条记录 · ${(ms / 1000).toFixed(1)} 秒`
    });
    return { id: source.id, name: source.name, role: source.role, status: 'done', count: records.length, ms, papers: records };
  } catch (error) {
    const ms = now() - started;
    const limited = /429|rate limit|too many/i.test(String(error.message));
    const status = limited ? 'skipped' : 'error';
    job.emit('stage', {
      id: source.id,
      status,
      detail: limited
        ? `${source.name} 触发限流，继续使用其余来源`
        : `${source.name} 请求失败，继续使用其余来源`
    });
    return { id: source.id, name: source.name, role: source.role, status, count: 0, ms, error: error.message, papers: [] };
  }
}

export async function runScouts({ plan, job }) {
  const results = await Promise.all(SOURCES.map(source => runSource(source, plan, job)));
  const papers = results.flatMap(result => result.papers);
  const sources = results.map(({ papers: _papers, ...meta }) => meta);
  return { papers, sources };
}
