import { useMemo, useState } from 'react';
import type { TraceEntry } from '../types';
import { Icon } from './Icon';
import { AGENT_LABEL } from '../i18n';

const TYPE_LABEL: Record<string, string> = {
  stage: '阶段',
  plan: '规划',
  papers: '语料',
  analysis: '分析',
  brief: '简报',
  review: '复核',
  usage: '词元',
  warning: '警告',
  meta: '元信息',
  error: '错误',
  done: '完成'
};

export function TraceView({ entries }: { entries: TraceEntry[] }) {
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const filtered = useMemo(
    () => entries.filter(entry => !onlyWarnings || ['warning', 'error', 'review'].includes(entry.type)),
    [entries, onlyWarnings]
  );

  return (
    <div className="trace-view">
      <div className="trace-head">
        <div>
          <span className="mono-label">执行轨迹</span>
          <h3>智能体消息</h3>
        </div>
        <button
          type="button"
          className={`toolbar-chip ${onlyWarnings ? 'active' : ''}`}
          onClick={() => setOnlyWarnings(value => !value)}
        >
          <Icon name="filter" size={12} /> 仅看警告
        </button>
      </div>
      <div className="trace-list">
        {filtered.length ? filtered.map(entry => (
          <div className={`trace-row ${entry.type}`} key={entry.id}>
            <span className="trace-time">{new Date(entry.at).toLocaleTimeString('zh-CN', { hour12: false })}</span>
            <span className="trace-type">{TYPE_LABEL[entry.type] || entry.type.toUpperCase()}</span>
            <span className="trace-agent">{AGENT_LABEL[entry.agent || ''] || entry.agent || '系统'}</span>
            <span className="trace-message">{entry.message}</span>
          </div>
        )) : (
          <div className="empty-state small">
            <p>暂无轨迹消息。</p>
          </div>
        )}
      </div>
    </div>
  );
}
