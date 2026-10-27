import type { Stage } from './types';

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低'
};

export const STATUS_LABEL: Record<string, string> = {
  queued: '等待',
  running: '运行中',
  done: '完成',
  error: '错误',
  skipped: '已跳过'
};

export const AGENT_LABEL: Record<string, string> = {
  planner: '规划智能体',
  semanticscholar: 'Semantic Scholar 检索',
  doaj: 'DOAJ 检索',
  crossref: 'Crossref 检索',
  analyst: '证据分析',
  'analyst-retry': '证据分析（重试）',
  synthesizer: '综合编辑',
  critic: '引用核查',
  scouts: '检索智能体',
  runtime: '运行时',
  model: '模型'
};

export function statusLabel(stage: Stage): string {
  return STATUS_LABEL[stage.status] || '等待';
}

export function confidenceLabel(value?: string | null): string {
  if (!value) return '—';
  return CONFIDENCE_LABEL[value] || value;
}
