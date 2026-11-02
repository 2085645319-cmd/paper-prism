import { useEffect, useState } from 'react';
import type { Paper, PaperInsight } from '../types';
import { translateAbstract } from '../api';
import { Icon } from './Icon';
import { SignalBar } from './Stat';

function authorLine(authors: string[], max = 3) {
  if (!authors.length) return '作者未列出';
  return authors.slice(0, max).join(', ') + (authors.length > max ? ' 等' : '');
}

function hasUsableAbstract(paper: Paper) {
  return Boolean(paper.abstract && paper.abstract.trim().length > 80);
}

function looksChinese(text: string) {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjk >= Math.max(8, text.length * 0.2);
}

export function PaperCard({
  paper,
  onOpen,
  featuredRank,
  inReadingPath = false,
  fullMode = false
}: {
  paper: Paper;
  onOpen: (paper: Paper) => void;
  featuredRank?: number;
  inReadingPath?: boolean;
  fullMode?: boolean;
}) {
  return (
    <article
      className={`paper-card ${featuredRank ? 'featured' : ''}`}
      onClick={() => onOpen(paper)}
      tabIndex={0}
      onKeyDown={event => event.key === 'Enter' && onOpen(paper)}
    >
      <div className="paper-topline">
        <span className="paper-id">{paper.id}</span>
        <span className="paper-meta">
          {paper.year || '年份未注'}
          {paper.venue ? ` · ${paper.venue}` : ''}
        </span>
        <span className="paper-cites">{paper.citations.toLocaleString()} 次引用</span>
      </div>
      {fullMode && (featuredRank || inReadingPath) && (
        <div className="paper-flags">
          {featuredRank && (
            <span className={`paper-pick rank-${featuredRank}`}>
              {featuredRank === 1 ? '首选精读' : '精读优先'}
            </span>
          )}
          {inReadingPath && <span className="paper-path">阅读路径</span>}
        </div>
      )}
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
  onClose,
  coverage = null,
  paperCount = 0,
  showCoverage = false,
  enableTranslation = false
}: {
  paper: Paper;
  insight?: PaperInsight;
  onClose: () => void;
  coverage?: number | null;
  paperCount?: number;
  showCoverage?: boolean;
  enableTranslation?: boolean;
}) {
  const [abstractLang, setAbstractLang] = useState<'source' | 'zh'>('source');
  const [translation, setTranslation] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');

  useEffect(() => {
    setAbstractLang('source');
    setTranslation('');
    setTranslating(false);
    setTranslateError('');
  }, [paper.id]);

  const citation = `${authorLine(paper.authors, 6)} (${paper.year || '年份未注'}). ${paper.title}. ${paper.venue || ''}${paper.doi ? ` https://doi.org/${paper.doi}` : paper.url ? ` ${paper.url}` : ''}`;
  const abstractIsChinese = looksChinese(paper.abstract || '');
  const canTranslate = enableTranslation && Boolean(paper.abstract) && !abstractIsChinese;
  const hasAbstract = hasUsableAbstract(paper);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
    } catch {
      // Clipboard may be unavailable in a non-secure context.
    }
  };

  const showChinese = async () => {
    setAbstractLang('zh');
    if (!canTranslate || translation || translating) return;
    setTranslating(true);
    setTranslateError('');
    try {
      const result = await translateAbstract(paper.abstract);
      setTranslation(result);
    } catch (error) {
      setTranslateError(error instanceof Error ? error.message : '摘要翻译失败。');
    } finally {
      setTranslating(false);
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

        {showCoverage && coverage != null && (
          <div className={`drawer-evidence ${hasAbstract ? 'ok' : 'warn'}`}>
            <div className="drawer-evidence-head">
              <span className="mono-label">证据覆盖</span>
              <strong>{Math.round(coverage * 100)}%</strong>
            </div>
            <p>
              本次检索 {paperCount || '—'} 篇文献中，约 {paperCount ? Math.round(coverage * paperCount) : '—'} 篇有可用摘要。
              本文{hasAbstract ? '摘要可用，可以直接作为分析证据。' : '只有题录或短摘要，建议打开原文核对。'}
            </p>
          </div>
        )}

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
          <div className="drawer-section-head">
            <span className="mono-label">摘要</span>
            {canTranslate && (
              <div className="abstract-switch" role="group" aria-label="摘要语言">
                <button
                  type="button"
                  className={abstractLang === 'source' ? 'active' : ''}
                  onClick={() => setAbstractLang('source')}
                >
                  English
                </button>
                <button
                  type="button"
                  className={abstractLang === 'zh' ? 'active' : ''}
                  onClick={showChinese}
                >
                  中文
                </button>
              </div>
            )}
            {!canTranslate && abstractIsChinese && paper.abstract && (
              <span className="abstract-origin">中文原文</span>
            )}
          </div>

          {abstractLang === 'zh' && canTranslate ? (
            translating ? (
              <p className="abstract-loading">正在翻译摘要…</p>
            ) : translation ? (
              <>
                <p>{translation}</p>
                <p className="abstract-note">中文译文由 DeepSeek 生成，仅供阅读；引用请以英文原文为准。</p>
              </>
            ) : (
              <>
                <p>{paper.abstract}</p>
                {translateError && (
                  <p className="abstract-error">
                    翻译失败：{translateError}
                    <button type="button" onClick={showChinese}>重试</button>
                  </p>
                )}
              </>
            )
          ) : (
            <p>{paper.abstract || '来源未提供摘要，请打开原文记录查看论文。'}</p>
          )}
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
