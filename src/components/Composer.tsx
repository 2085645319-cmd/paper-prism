import { useEffect, useRef } from 'react';
import type { Paper } from '../types';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  examples: string[];
}

export function Composer({ value, onChange, onSubmit, loading, examples }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="composer">
      <div className="composer-label">
        <span className="mono-label">研究课题</span>
        <span className="composer-count">{value.length}/240</span>
      </div>
      <textarea
        id="topic-input"
        ref={ref}
        value={value}
        maxLength={240}
        rows={2}
        placeholder="输入研究课题，例如：多模态大模型的可信推理"
        onChange={event => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="研究课题"
      />
      <div className="composer-footer">
        <div className="example-row">
          <span className="mono-label">试试</span>
          {examples.map(example => (
            <button
              type="button"
              key={example}
              className="example-chip"
              onClick={() => {
                onChange(example);
                ref.current?.focus();
              }}
            >
              {example}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={onSubmit}
          disabled={loading || value.trim().length < 3}
        >
          {loading ? '检索中' : '开始研究'}
          <span className="button-key">↵</span>
        </button>
      </div>
    </div>
  );
}

export function CitationText({
  text,
  papers,
  onCite
}: {
  text: string;
  papers: Paper[];
  onCite: (paper: Paper) => void;
}) {
  const byId = new Map(papers.map(paper => [paper.id, paper]));
  const parts = text.split(/(\[P\d+\])/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\[(P\d+)\]$/);
        if (!match) return <span key={index}>{part}</span>;
        const paper = byId.get(match[1]);
        if (!paper) return <span key={index}>{part}</span>;
        return (
          <button
            type="button"
            className="cite-chip"
            key={index}
            onClick={() => onCite(paper)}
            title={paper.title}
          >
            {paper.id}
          </button>
        );
      })}
    </>
  );
}
