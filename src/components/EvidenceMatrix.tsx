import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Analysis, Paper, PaperInsight } from '../types';
import { Icon } from './Icon';

type Field = 'method' | 'finding' | 'limitation';

const FIELD_LABEL: Record<Field, string> = {
  method: '方法',
  finding: '发现',
  limitation: '局限'
};

function splitSentences(text: string) {
  return String(text || '')
    .split(/(?<=[.!?。！？])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 20);
}

function tokenize(text: string) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .match(/[a-z][a-z-]{2,}|[\u4e00-\u9fff]{2,}/g) || []
  );
}

function closestSentence(abstract: string, claim: string) {
  const sentences = splitSentences(abstract);
  if (!sentences.length) return '';
  const claimTokens = tokenize(claim);
  if (!claimTokens.size) return sentences[0];
  let best = sentences[0];
  let bestScore = -1;
  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    let score = 0;
    for (const token of claimTokens) if (tokens.has(token)) score += 1;
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : '';
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(papers: Paper[], analysis: Analysis | null) {
  const header = ['编号', '年份', '标题', '方法', '主要发现', '局限', '引用', '来源', 'DOI', 'URL'];
  const rows = papers.map(paper => {
    const insight = analysis?.papers[paper.id];
    return [
      paper.id,
      paper.year || '',
      paper.title,
      insight?.method || '',
      insight?.finding || '',
      insight?.limitation || '',
      paper.citations,
      paper.sources.join(' / '),
      paper.doi || '',
      paper.url || ''
    ].map(csvCell).join(',');
  });
  const blob = new Blob([`\uFEFF${header.map(csvCell).join(',')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'prism-evidence-matrix.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function markdownTable(papers: Paper[], analysis: Analysis | null) {
  const lines = [
    '| 编号 | 年份 | 标题 | 方法 | 主要发现 | 局限 |',
    '|---|---|---|---|---|---|'
  ];
  for (const paper of papers) {
    const insight = analysis?.papers[paper.id];
    lines.push(`| ${paper.id} | ${paper.year || '—'} | ${paper.title} | ${insight?.method || '—'} | ${insight?.finding || '—'} | ${insight?.limitation || '—'} |`);
  }
  return lines.join('\n');
}

function Cell({
  paper,
  field,
  text,
  onOpen
}: {
  paper: Paper;
  field: Field;
  text: string;
  onOpen: (paper: Paper, field: Field) => void;
}) {
  return (
    <button
      type="button"
      className={`matrix-cell ${text && !/Not stated|未说明/i.test(text) ? '' : 'muted'}`}
      onClick={() => onOpen(paper, field)}
      title={`${FIELD_LABEL[field]}：${text || '—'}`}
    >
      <span>{text || '—'}</span>
    </button>
  );
}

export function EvidenceMatrix({
  papers,
  analysis,
  readingPath,
  coverage,
  onOpenPaper
}: {
  papers: Paper[];
  analysis: Analysis | null;
  readingPath: string[];
  coverage?: number | null;
  onOpenPaper: (paper: Paper) => void;
}) {
  const [active, setActive] = useState<{ paper: Paper; field: Field; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const featured = useMemo(() => new Map(readingPath.slice(0, 3).map((id, index) => [id, index + 1])), [readingPath]);
  const insights: Record<string, PaperInsight> = analysis?.papers || {};

  const openCell = (paper: Paper, field: Field, insight?: PaperInsight) => {
    const text = insight?.[field] || '当前摘要没有提供这一项。';
    setActive({ paper, field, text });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdownTable(papers, analysis));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be unavailable; CSV export still works.
    }
  };

  if (!papers.length) {
    return <div className="empty-state"><h3>暂无可对比的文献</h3></div>;
  }

  const activeInsight = active ? insights[active.paper.id] : undefined;
  const activeQuote = active ? closestSentence(active.paper.abstract, active.text) : '';

  return (
    <div className="evidence-matrix">
      <div className="matrix-head">
        <div>
          <span className="mono-label">证据矩阵</span>
          <h3>把 {papers.length} 篇文献压成一张可核对的表</h3>
          <p>点击任意格子，查看模型抽取与摘要中最接近的原句。</p>
        </div>
        <div className="matrix-actions">
          {coverage != null && <span className="matrix-coverage">摘要覆盖 {Math.round(coverage * 100)}%</span>}
          <button type="button" className="secondary-button small" onClick={copy}>
            <Icon name="copy" size={12} /> {copied ? '已复制' : '复制 Markdown'}
          </button>
          <button type="button" className="secondary-button small" onClick={() => downloadCsv(papers, analysis)}>
            <Icon name="download" size={12} /> 导出 CSV
          </button>
        </div>
      </div>

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="matrix-paper-col">论文</th>
              <th>方法</th>
              <th>主要发现</th>
              <th>局限</th>
              <th className="matrix-num-col">引用</th>
              <th className="matrix-source-col">来源</th>
            </tr>
          </thead>
          <tbody>
            {papers.map(paper => {
              const insight = insights[paper.id];
              const rank = featured.get(paper.id);
              return (
                <tr key={paper.id} className={rank ? `featured rank-${rank}` : ''}>
                  <td className="matrix-paper-col">
                    <button type="button" className="matrix-paper" onClick={() => onOpenPaper(paper)}>
                      <span className="matrix-paper-top">
                        <b>{paper.id}</b>
                        <span>{paper.year || '—'}</span>
                        {rank && <em className="paper-pick rank-1">{rank === 1 ? '首选精读' : '精读优先'}</em>}
                      </span>
                      <strong>{paper.title}</strong>
                      <small>{paper.venue || '来源未注'}</small>
                    </button>
                  </td>
                  <td><Cell paper={paper} field="method" text={insight?.method || '—'} onOpen={(p, f) => openCell(p, f, insight)} /></td>
                  <td><Cell paper={paper} field="finding" text={insight?.finding || '—'} onOpen={(p, f) => openCell(p, f, insight)} /></td>
                  <td><Cell paper={paper} field="limitation" text={insight?.limitation || '—'} onOpen={(p, f) => openCell(p, f, insight)} /></td>
                  <td className="matrix-num-col">{paper.citations.toLocaleString()}</td>
                  <td className="matrix-source-col">{paper.sources.join(' · ') || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {active && createPortal(
        <div className="matrix-inspector-backdrop" onClick={() => setActive(null)}>
          <aside className="matrix-inspector" onClick={event => event.stopPropagation()}>
            <div className="matrix-inspector-head">
              <span className="mono-label">证据 / {active.paper.id} · {FIELD_LABEL[active.field]}</span>
              <button type="button" className="icon-button" onClick={() => setActive(null)} aria-label="关闭证据">
                <Icon name="close" size={15} />
              </button>
            </div>
            <h4>{active.paper.title}</h4>
            <p className="matrix-inspector-meta">
              {active.paper.year || '年份未注'} · {active.paper.venue || '来源未注'} · {active.paper.citations.toLocaleString()} 次引用
            </p>

            <div className="matrix-inspector-block">
              <span className="mono-label">模型抽取</span>
              <blockquote>{active.text}</blockquote>
            </div>

            <div className="matrix-inspector-block">
              <span className="mono-label">摘要中最接近的原句</span>
              {activeQuote ? (
                <blockquote className="quote">{activeQuote}</blockquote>
              ) : (
                <p className="matrix-empty-quote">
                  {active.paper.abstract
                    ? '摘要中没有找到与这条抽取直接对应的句子，请打开原文核对。'
                    : '来源没有提供摘要，无法给出原句证据。'}
                </p>
              )}
            </div>

            {activeInsight?.keyPoints?.length ? (
              <div className="matrix-inspector-block">
                <span className="mono-label">关键点</span>
                <ul className="key-points">
                  {activeInsight.keyPoints.map(point => <li key={point}>{point}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="matrix-inspector-actions">
              <button type="button" className="primary-button small" onClick={() => { setActive(null); onOpenPaper(active.paper); }}>
                查看完整证据轨迹 <Icon name="arrow" size={12} />
              </button>
              {active.paper.url && (
                <a className="secondary-button small" href={active.paper.url} target="_blank" rel="noreferrer">
                  打开原文 <Icon name="external" size={12} />
                </a>
              )}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
