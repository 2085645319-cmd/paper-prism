import type { Analysis, Brief, Paper, Quality } from '../types';
import { CitationText } from './Composer';
import { Icon } from './Icon';
import { confidenceLabel } from '../i18n';

function SourceChips({ ids, papers, onCite }: { ids: string[]; papers: Paper[]; onCite: (paper: Paper) => void }) {
  return (
    <span className="source-chips">
      {[...new Set(ids)].map(id => {
        const paper = papers.find(item => item.id === id);
        if (!paper) return null;
        return (
          <button type="button" className="cite-chip" key={id} onClick={() => onCite(paper)} title={paper.title}>
            {id}
          </button>
        );
      })}
    </span>
  );
}

export function BriefView({
  brief,
  analysis,
  quality,
  papers,
  onCite
}: {
  brief: Brief | null;
  analysis: Analysis | null;
  quality: Quality | null;
  papers: Paper[];
  onCite: (paper: Paper) => void;
}) {
  if (!brief) {
    return (
      <div className="loading-brief">
        <div className="loading-line wide" />
        <div className="loading-line" />
        <div className="loading-grid">
          <div /><div /><div />
        </div>
        <div className="loading-note">
          <span className="pulse-dot" />
          {papers.length ? '正在综合证据…' : '等待第一批文献…'}
        </div>
      </div>
    );
  }

  const paperById = new Map(papers.map(paper => [paper.id, paper]));

  return (
    <div className="brief">
      <div className="brief-editorial">
        <div className="brief-kicker">
          <span className="mono-label">文献简报</span>
          {quality && <span className={`confidence-pill ${quality.confidence}`}>{confidenceLabel(quality.confidence)}置信度</span>}
        </div>
        <h2>{brief.title}</h2>
        <p className="brief-standfirst">{brief.standfirst}</p>
        <p className="brief-scope">{brief.scope}</p>
        {brief.mode === 'heuristic' && (
          <div className="inline-warning">
            <Icon name="alert" size={14} />
            <span>当前为启发式摘要：DeepSeek 综合暂不可用，论文原文与检索结果仍然有效。</span>
          </div>
        )}
      </div>

      {analysis && analysis.keywords.length > 0 && (
        <div className="keyword-row">
          {analysis.keywords.map(keyword => <span key={keyword} className="keyword">{keyword}</span>)}
        </div>
      )}

      <section className="brief-section">
        <div className="section-head">
          <span className="section-number">01</span>
          <div>
            <span className="mono-label">领域图谱</span>
            <h3>核心主题</h3>
          </div>
          <span className="section-note">{brief.keyThemes.length} 个主题</span>
        </div>
        <div className="theme-grid">
          {brief.keyThemes.map((theme, index) => (
            <article className="theme-card" key={`${theme.name}-${index}`}>
              <div className="theme-index">{String(index + 1).padStart(2, '0')}</div>
              <h4>{theme.name}</h4>
              <p><CitationText text={theme.insight} papers={papers} onCite={onCite} /></p>
              <div className="theme-foot">
                <SourceChips ids={theme.paperIds} papers={papers} onCite={onCite} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="brief-section split-section">
        <div className="split-col">
          <div className="section-head compact">
            <span className="section-number">02</span>
            <div><span className="mono-label">共识</span><h3>已经形成共识</h3></div>
          </div>
          <ol className="claim-list">
            {brief.consensus.map((claim, index) => (
              <li key={`${claim}-${index}`}>
                <span className="claim-index">{String(index + 1).padStart(2, '0')}</span>
                <p><CitationText text={claim} papers={papers} onCite={onCite} /></p>
              </li>
            ))}
          </ol>
        </div>
        <div className="split-col">
          <div className="section-head compact">
            <span className="section-number">03</span>
            <div><span className="mono-label">分歧</span><h3>仍在拉扯的分歧</h3></div>
          </div>
          <ol className="claim-list">
            {brief.tensions.length ? brief.tensions.map((claim, index) => (
              <li key={`${claim}-${index}`}>
                <span className="claim-index">{String(index + 1).padStart(2, '0')}</span>
                <p><CitationText text={claim} papers={papers} onCite={onCite} /></p>
              </li>
            )) : <li className="empty-claim">当前语料中没有发现足够明确的正面冲突；这本身是一个值得核实的信号。</li>}
          </ol>
        </div>
      </section>

      <section className="brief-section">
        <div className="section-head">
          <span className="section-number">04</span>
          <div>
            <span className="mono-label">未解问题</span>
            <h3>还没解决的问题</h3>
          </div>
          <span className="section-note">{brief.painPoints.length} 个缺口</span>
        </div>
        <div className="pain-list">
          {brief.painPoints.map((pain, index) => (
            <article className="pain-card" key={`${pain.title}-${index}`}>
              <div className="pain-top">
                <span className="pain-index">{String(index + 1).padStart(2, '0')}</span>
                <h4>{pain.title}</h4>
                <SourceChips ids={pain.evidenceIds} papers={papers} onCite={onCite} />
              </div>
              <p><CitationText text={pain.detail} papers={papers} onCite={onCite} /></p>
              {pain.opportunity && (
                <div className="opportunity">
                  <span className="mono-label">研究切口</span>
                  <p>{pain.opportunity}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {brief.futureDirections.length > 0 && (
        <section className="brief-section">
          <div className="section-head">
            <span className="section-number">05</span>
            <div><span className="mono-label">下一步</span><h3>可以怎么做</h3></div>
          </div>
          <div className="direction-grid">
            {brief.futureDirections.map(direction => (
              <article className="direction-card" key={direction.title}>
                <h4>{direction.title}</h4>
                <p><CitationText text={direction.detail} papers={papers} onCite={onCite} /></p>
                <SourceChips ids={direction.evidenceIds} papers={papers} onCite={onCite} />
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="brief-section">
        <div className="section-head">
          <span className="section-number">06</span>
          <div><span className="mono-label">阅读路径</span><h3>按这个顺序读</h3></div>
        </div>
        <div className="reading-path">
          {brief.readingPath.map((item, index) => {
            const paper = paperById.get(item.paperId);
            if (!paper) return null;
            return (
              <div className="reading-row" key={item.paperId}>
                <span className="reading-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="reading-body">
                  <button type="button" className="reading-title" onClick={() => onCite(paper)}>{paper.title}</button>
                  <span>{paper.year || '年份未注'} · {paper.venue || '文献'} · {paper.citations.toLocaleString()} 次引用</span>
                  <p>{item.why}</p>
                </div>
                <span className="reading-id">{item.paperId}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="brief-section method-section">
        <div className="section-head">
          <span className="section-number">07</span>
          <div><span className="mono-label">方法与局限</span><h3>这份简报怎么来的</h3></div>
        </div>
        <div className="method-grid">
          <div>
            <span className="mono-label">方法</span>
            <ul>{brief.methodNotes.map(note => <li key={note}>{note}</li>)}</ul>
          </div>
          <div>
            <span className="mono-label">局限</span>
            <ul>{brief.caveats.map(note => <li key={note}>{note}</li>)}</ul>
          </div>
        </div>
      </section>
    </div>
  );
}
