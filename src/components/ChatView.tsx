import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, RelatedPaper } from '../types';
import { Icon } from './Icon';

const PROMPTS = [
  '过去这方面有哪些经典工作？',
  '再找一些 2025–2026 年的新文章',
  '这些方法里哪个更适合落地？',
  '给我 3 个可以继续做的研究切口'
];

function PaperLink({ paper }: { paper: RelatedPaper }) {
  const href = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : '');
  const body = (
    <>
      <span className="chat-paper-body">
        <span className="chat-paper-title">{paper.title}</span>
        <span className="chat-paper-meta">
          {paper.year || '年份未注'} · {paper.venue || '来源未注'}
          {paper.why ? ` · ${paper.why}` : ''}
        </span>
      </span>
    </>
  );
  return href ? (
    <a className="chat-paper" href={href} target="_blank" rel="noreferrer">
      {body}
      <Icon name="external" size={11} />
    </a>
  ) : (
    <div className="chat-paper">{body}</div>
  );
}

export function ChatView({
  messages,
  loading,
  disabled = false,
  paperCount,
  onSend
}: {
  messages: ChatMessage[];
  loading: boolean;
  disabled?: boolean;
  paperCount: number;
  onSend: (question: string) => void;
}) {
  const [value, setValue] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, loading]);

  const send = (text = value) => {
    const question = text.trim();
    if (!question || loading || disabled) return;
    onSend(question);
    setValue('');
  };

  return (
    <div className="chat-view">
      <div className="chat-head">
        <div>
          <span className="mono-label">研究对话</span>
          <h3>在这一次研究上继续追问</h3>
        </div>
        <span className="chat-context">基于当前 {paperCount} 篇文献</span>
      </div>

      <div className="chat-stream" ref={listRef}>
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <span className="mono-label">不用重新开始</span>
            <h4>看完简报，还可以继续问</h4>
            <p>
              我已经读完当前 {paperCount} 篇文献。想看更早的经典工作、更多近年论文，或者讨论落地场景，都可以直接说。
            </p>
            <div className="chat-prompt-grid">
              {PROMPTS.map(prompt => (
                <button type="button" key={prompt} className="chat-prompt" onClick={() => send(prompt)}>
                  {prompt}
                  <Icon name="arrow" size={12} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(message => (
            <article key={message.id} className={`chat-message ${message.role}`}>
              <span className="chat-role">{message.role === 'user' ? '你' : 'PRISM'}</span>
              <div className="chat-content">{message.content}</div>
              {message.papers && message.papers.length > 0 && (
                <div className="chat-papers">
                  <span className="mono-label">补充论文</span>
                  {message.papers.map(paper => <PaperLink key={`${paper.id}-${paper.doi || paper.title}`} paper={paper} />)}
                </div>
              )}
              {message.role === 'assistant' && message.followUps && message.followUps.length > 0 && (
                <div className="chat-followups">
                  {message.followUps.map(prompt => (
                    <button type="button" key={prompt} className="chat-followup" onClick={() => send(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
        {loading && (
          <div className="chat-message assistant loading">
            <span className="chat-role">PRISM</span>
            <div className="chat-content"><span className="pulse-dot" /> 正在结合当前文献回答…</div>
          </div>
        )}
      </div>

      <div className="chat-composer">
        <textarea
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={600}
          disabled={disabled}
          placeholder={disabled ? '研究完成后即可继续对话' : '继续问：过去有哪些经典工作？再找一些近年论文…'}
          aria-label="研究对话输入"
        />
        <button type="button" className="primary-button small" onClick={() => send()} disabled={disabled || loading || !value.trim()}>
          发送 <Icon name="arrow" size={13} />
        </button>
      </div>
      <div className="chat-footnote">对话基于当前研究结果；需要换课题时点右上角「开启新对话」。</div>
    </div>
  );
}
