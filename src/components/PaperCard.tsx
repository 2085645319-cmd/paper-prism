import type { Paper, PaperInsight } from '../types';
import { Icon } from './Icon';
import { SignalBar } from './Stat';

function authorLine(authors: string[], max = 3) {
  if (!authors.length) return '作者未列出';
  return authors.slice(0, max).join(', ') + (authors.length > max ? ' 等' : '');
}

export function PaperCard({
  paper,
  onOpen
}: {
  paper: Paper;
  onOpen: (paper: Paper) => void;
}) {
  return (
    <article className="paper-card" onClick={() => onOpen(paper)} tabIndex={0} onKeyDown={event => event.key === 'Enter' && onOpen(paper)}>
      <div className="paper-topline">
        <span className="paper-id">{paper.id}</span>
        <span className="paper-meta">
          {paper.year || '年份未注'}
          {paper.venue ? ` · ${paper.venue}` : ''}
        </span>
        <span className="paper-cites">{paper.citations.toLocaleString()} 次引用</span>
      </div>
      <h3>{paper.title}</h3>
      <p className="paper-authors">{authorLine(paper.authors)}</p>
      {paper.abstract && <p className="paper-abstract">{paper.abstract}</p>}
      <div className="paper-foot">
        <div className="paper-tags">
          {paper.sources.map(source => <span key={source} className="tag">{source}</span>)}
          {paper.openAccess && <span className="tag oa">开放</span>}
        </div>
        <div className="paper-signal">
          <SignalBar value={paper.signal} />
        </div>
        {paper.url && (
          <a
            className="paper-link"
            href={paper.url}
            target="_blank"
            rel="noreferrer"
            onClick={event => event.stopPropagation()}
          >
            原文 <Icon name="external" size={12} />
          </a>
        )}
      </div>
    </article>
  );
}

export function PaperDrawer({
  paper,
  insight,
  onClose
}: {
  paper: Paper;
  insight?: PaperInsight;
  onClose: () => void;
}) {
  const citation = `${authorLine(paper.authors, 6)} (${paper.year || '年份未注'}). ${paper.title}. ${paper.venue || ''}${paper.doi ? ` https://doi.org/${paper.doi}` : paper.url ? ` ${paper.url}` : ''}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
    } catch {
      // Clipboard may be unavailable in a non-secure context.
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="paper-drawer" onClick={event => event.stopPropagation()}>
        <div className="drawer-head">
          <span className="mono-label">文献 / {paper.id}</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭文献">
            <Icon name="close" size={16} />
          </button>
        </div>
        <h2>{paper.title}</h2>
        <p className="drawer-authors">{authorLine(paper.authors, 10)}</p>
        <div className="drawer-meta">
          <span>{paper.year || '年份未注'}</span>
          <span>{paper.venue || '期刊/会议未列出'}</span>
          <span>{paper.citations.toLocaleString()} 次引用</span>
        </div>

        <div className="drawer-actions">
          {paper.url && (
            <a className="primary-button small" href={paper.url} target="_blank" rel="noreferrer">
              打开原文 <Icon name="external" size={13} />
            </a>
          )}
          <button type="button" className="secondary-button small" onClick={copy}>
            <Icon name="copy" size={13} /> 复制引用
          </button>
        </div>

        <section className="drawer-section">
          <span className="mono-label">摘要</span>
          <p>{paper.abstract || '来源未提供摘要，请打开原文记录查看论文。'}</p>
        </section>

        {insight && (
          <section className="drawer-section">
            <span className="mono-label">证据轨迹</span>
            <div className="insight-grid">
              <div><span>方法</span><p>{insight.method}</p></div>
              <div><span>发现</span><p>{insight.finding}</p></div>
              <div><span>局限</span><p>{insight.limitation}</p></div>
            </div>
            {insight.keyPoints.length > 0 && (
              <ul className="key-points">
                {insight.keyPoints.map(point => <li key={point}>{point}</li>)}
              </ul>
            )}
          </section>
        )}

        <section className="drawer-section">
          <span className="mono-label">来源记录</span>
          <div className="source-record">
            <span>{paper.sources.join(' · ') || '未知来源'}</span>
            {paper.doi && <code>{paper.doi}</code>}
          </div>
        </section>
      </aside>
    </div>
  );
}
