import type { CorpusStats, Paper, Quality, SourceStat } from '../types';

function formatNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function yearBuckets(papers: Paper[], stats: CorpusStats | null) {
  const years = papers.map(paper => paper.year).filter((year): year is number => Boolean(year));
  if (!years.length) return [];
  const min = stats?.yearMin || Math.min(...years);
  const max = stats?.yearMax || Math.max(...years);
  const span = Math.max(1, max - min + 1);
  if (span <= 8) {
    return Array.from({ length: span }, (_, index) => {
      const year = min + index;
      return { label: String(year).slice(2), count: years.filter(value => value === year).length, year };
    });
  }
  const bucketSize = Math.ceil(span / 8);
  return Array.from({ length: 8 }, (_, index) => {
    const start = min + index * bucketSize;
    const end = Math.min(max, start + bucketSize - 1);
    return {
      label: `${String(start).slice(2)}`,
      count: years.filter(value => value >= start && value <= end).length,
      year: start
    };
  });
}

export function ResearchTelemetry({
  papers,
  sources,
  stats,
  quality,
  running
}: {
  papers: Paper[];
  sources: SourceStat[];
  stats: CorpusStats | null;
  quality: Quality | null;
  running: boolean;
}) {
  if (!papers.length) return null;

  const buckets = yearBuckets(papers, stats);
  const maxBucket = Math.max(1, ...buckets.map(bucket => bucket.count));
  const sourceTotal = sources.reduce((sum, source) => sum + source.count, 0);
  const maxSource = Math.max(1, ...sources.map(source => source.count));
  const abstractPct = papers.length ? papers.filter(paper => paper.abstract && paper.abstract.length > 80).length / papers.length : 0;
  const tokens = quality?.tokens || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const tokenPct = tokens.totalTokens ? Math.round((tokens.promptTokens / tokens.totalTokens) * 100) : 0;
  const ring = 2 * Math.PI * 24;

  return (
    <section className="telemetry" aria-label="研究遥测">
      <div className="telemetry-head">
        <span className="mono-label">运行遥测</span>
        <span className={`telemetry-live ${running ? '' : 'sealed'}`}><i /> {running ? '实时快照' : '封存快照'}</span>
      </div>
      <div className="telemetry-grid">
        <article className="telemetry-card">
          <div className="telemetry-top">
            <span className="mono-label">来源构成</span>
            <span>{sourceTotal} 条记录</span>
          </div>
          <div className="source-bars">
            {sources.map(source => (
              <div className={`source-bar-row ${source.status}`} key={source.id}>
                <span>{source.name}</span>
                <div className="source-bar-track">
                  <i style={{ width: `${Math.max(4, (source.count / maxSource) * 100)}%` }} />
                </div>
                <b>{source.status === 'done' ? source.count : '—'}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="telemetry-card">
          <div className="telemetry-top">
            <span className="mono-label">年份分布</span>
            <span>{stats?.yearMin || '—'}—{stats?.yearMax || '—'}</span>
          </div>
          <div className="year-chart">
            {buckets.map(bucket => (
              <div className="year-column" key={bucket.label} title={`${bucket.year} 年：${bucket.count} 篇`}>
                <span className="year-count">{bucket.count || ''}</span>
                <i style={{ height: `${Math.max(3, (bucket.count / maxBucket) * 42)}px` }} />
                <span className="year-label">{bucket.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="telemetry-card evidence-card">
          <div className="telemetry-top">
            <span className="mono-label">证据覆盖</span>
            <span>{papers.length} 篇文献</span>
          </div>
          <div className="evidence-body">
            <svg viewBox="0 0 64 64" className="evidence-ring" aria-hidden="true">
              <circle cx="32" cy="32" r="24" className="ring-track" />
              <circle
                cx="32"
                cy="32"
                r="24"
                className="ring-value"
                strokeDasharray={`${abstractPct * ring} ${ring}`}
              />
            </svg>
            <div className="evidence-metrics">
              <strong>{Math.round(abstractPct * 100)}%</strong>
              <span>摘要覆盖率</span>
              <small>{papers.filter(paper => paper.openAccess).length} 篇开放获取</small>
            </div>
          </div>
        </article>

        <article className="telemetry-card token-card">
          <div className="telemetry-top">
            <span className="mono-label">模型预算</span>
            <span>{quality ? (quality.mode === 'heuristic' ? '启发式' : 'DeepSeek') : '估算中'}</span>
          </div>
          <div className="token-total">
            <strong>{tokens.totalTokens ? formatNumber(tokens.totalTokens) : '—'}</strong>
            <span>词元</span>
          </div>
          <div className="token-split">
            <i style={{ width: `${tokenPct}%` }} />
            <b style={{ width: `${100 - tokenPct}%` }} />
          </div>
          <div className="token-legend">
            <span><i className="prompt" /> 输入 {tokens.promptTokens ? formatNumber(tokens.promptTokens) : '—'}</span>
            <span><i className="output" /> 输出 {tokens.completionTokens ? formatNumber(tokens.completionTokens) : '—'}</span>
          </div>
        </article>
      </div>
    </section>
  );
}
