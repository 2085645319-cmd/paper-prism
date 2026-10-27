import type { Quality, ResearchPlan, SourceStat, Stage } from '../types';
import { AgentMeshCanvas } from './AgentMeshCanvas';
import { confidenceLabel, statusLabel } from '../i18n';

export function AgentRail({
  stages,
  plan,
  quality,
  sources
}: {
  stages: Stage[];
  plan: ResearchPlan | null;
  quality: Quality | null;
  sources: SourceStat[];
}) {
  const done = stages.filter(stage => stage.status === 'done').length;
  const progress = stages.length ? Math.round((done / stages.length) * 100) : 0;
  const hasChinese = (text = '') => /[\u4e00-\u9fff]/.test(text);
  const localizedField = plan ? (hasChinese(plan.field) ? plan.field : '跨学科研究') : '';
  const dimensions = plan
    ? plan.dimensions.map((dimension, index) => ({
        name: hasChinese(dimension.name) ? dimension.name : `研究视角 ${index + 1}`,
        question: hasChinese(dimension.question) ? dimension.question : '查看该视角下的主题与证据。'
      }))
    : [];

  return (
    <aside className="agent-rail">
      <div className="rail-head">
        <span className="mono-label">智能体网络</span>
        <span className="rail-progress">{progress}%</span>
      </div>
      <div className="rail-progress-track"><span style={{ width: `${progress}%` }} /></div>
      <AgentMeshCanvas stages={stages} />

      <ol className="stage-list">
        {stages.map((stage, index) => (
          <li key={stage.id} className={`stage-row ${stage.status}`}>
            <div className="stage-index">{String(index + 1).padStart(2, '0')}</div>
            <div className="stage-body">
              <div className="stage-top">
                <span className="stage-name">{stage.name}</span>
                <span className={`stage-status ${stage.status}`}>
                  {statusLabel(stage)}
                </span>
              </div>
              <div className="stage-role">{stage.role}</div>
              {stage.detail && <div className="stage-detail">{stage.detail}</div>}
            </div>
          </li>
        ))}
      </ol>

      {sources.length > 0 && (
        <div className="rail-block">
          <span className="mono-label">来源</span>
          <div className="source-list">
            {sources.map(source => (
              <div key={source.id} className="source-row">
                <span className={`source-dot ${source.status}`} />
                <span>{source.name}</span>
                <span className="source-count">{source.status === 'done' ? source.count : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan && (
        <div className="rail-block">
          <span className="mono-label">检索计划</span>
          <div className="plan-field">{localizedField}</div>
          <details className="query-details">
            <summary>查看 {plan.queries.length} 条英文检索式</summary>
            <div className="query-list">
              {plan.queries.slice(0, 5).map((query, index) => (
                <div key={query} className="query-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{query}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {plan && (
        <div className="rail-block">
          <span className="mono-label">分析视角</span>
          <div className="lens-list">
            {dimensions.map(dimension => (
              <div key={dimension.name} className="lens-row">
                <strong>{dimension.name}</strong>
                <p>{dimension.question}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {quality && (
        <div className="rail-block">
          <span className="mono-label">质量闸门</span>
          <div className={`confidence ${quality.confidence}`}>
            <span className="confidence-dot" />
            {confidenceLabel(quality.confidence)}置信度
          </div>
          <div className="check-list">
            {quality.checks.map(check => (
              <div key={check.label} className={`check-row ${check.status}`} title={check.detail}>
                <span className="check-mark">{check.status === 'pass' ? '✓' : '!'}</span>
                <span>{check.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
