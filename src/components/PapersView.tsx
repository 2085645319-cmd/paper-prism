import { useMemo, useState } from 'react';
import type { Paper } from '../types';
import { Icon } from './Icon';
import { PaperCard } from './PaperCard';

export function PapersView({ papers, onOpen }: { papers: Paper[]; onOpen: (paper: Paper) => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'signal' | 'citations' | 'year'>('signal');
  const [source, setSource] = useState('all');
  const [openOnly, setOpenOnly] = useState(false);

  const sources = useMemo(() => [...new Set(papers.flatMap(paper => paper.sources))], [papers]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return papers
      .filter(paper => {
        if (openOnly && !paper.openAccess) return false;
        if (source !== 'all' && !paper.sources.includes(source)) return false;
        if (!needle) return true;
        return `${paper.title} ${paper.authors.join(' ')} ${paper.venue} ${paper.abstract}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (sort === 'citations') return b.citations - a.citations;
        if (sort === 'year') return (b.year || 0) - (a.year || 0);
        return b.signal - a.signal;
      });
  }, [papers, query, sort, source, openOnly]);

  return (
    <div className="papers-view">
      <div className="papers-toolbar">
        <label className="paper-search">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="筛选标题、作者、摘要…"
            aria-label="筛选文献"
          />
        </label>
        <div className="toolbar-group">
          <span className="mono-label">排序</span>
          {(['signal', 'citations', 'year'] as const).map(value => (
            <button
              type="button"
              key={value}
              className={`toolbar-chip ${sort === value ? 'active' : ''}`}
              onClick={() => setSort(value)}
            >
              {value === 'signal' ? '信号' : value === 'citations' ? '引用' : '最新'}
            </button>
          ))}
        </div>
        <div className="toolbar-group">
          <span className="mono-label">来源</span>
          <button type="button" className={`toolbar-chip ${source === 'all' ? 'active' : ''}`} onClick={() => setSource('all')}>全部</button>
          {sources.map(item => (
            <button type="button" key={item} className={`toolbar-chip ${source === item ? 'active' : ''}`} onClick={() => setSource(item)}>{item}</button>
          ))}
        </div>
        <button type="button" className={`toolbar-chip oa-toggle ${openOnly ? 'active' : ''}`} onClick={() => setOpenOnly(value => !value)}>
          <Icon name="check" size={12} /> 开放获取
        </button>
        <span className="papers-count">{filtered.length}/{papers.length}</span>
      </div>

      {filtered.length ? (
        <div className="paper-grid">
          {filtered.map(paper => <PaperCard key={paper.id} paper={paper} onOpen={onOpen} />)}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="search" size={22} />
          <h3>没有匹配的文献</h3>
          <p>换一个关键词，或清除来源筛选。</p>
        </div>
      )}
    </div>
  );
}
