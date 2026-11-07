import type { PrismEvent, ResearchResult, Stage } from '../types';
import fixtureJson from './fixture.json';

export const DEMO_TOPIC = '多模态大模型的可信推理';

const fixture = fixtureJson as unknown as ResearchResult;
const demoStages: Stage[] = [
  { id: 'planner', name: '规划智能体', role: '拆解研究问题', short: 'PLAN', status: 'queued', detail: '拆解研究问题' },
  { id: 'semanticscholar', name: 'Semantic Scholar', role: '引用感知学术图谱', short: 'SCAN', status: 'queued', detail: '引用感知学术图谱' },
  { id: 'doaj', name: 'DOAJ 检索', role: '开放获取期刊', short: 'SCAN', status: 'queued', detail: '开放获取期刊' },
  { id: 'crossref', name: 'Crossref 检索', role: 'DOI 元数据', short: 'SCAN', status: 'queued', detail: 'DOI 元数据' },
  { id: 'analyst', name: '证据分析', role: '抽取论点与局限', short: 'READ', status: 'queued', detail: '抽取论点与局限' },
  { id: 'synthesizer', name: '综合编辑', role: '归纳主题与未解问题', short: 'SYNTH', status: 'queued', detail: '归纳主题与未解问题' },
  { id: 'critic', name: '引用核查', role: '复核证据链与缺口来源', short: 'CHECK', status: 'queued', detail: '复核证据链与缺口来源' }
];

const confidenceLabel = (confidence: string) => confidence === 'high' ? '高置信度' : confidence === 'medium' ? '中置信度' : '低置信度';
const sourceById = (id: string) => fixture.sources.find(source => source.id === id);

/**
 * Replays a local, pre-computed research run. It never calls the backend,
 * DeepSeek, or any scholarly API; the delays only make the agent mesh visible.
 */
export function runDemoResearch(onEvent: (event: PrismEvent) => void): () => void {
  let stopped = false;
  const timers: number[] = [];

  const emit = (type: string, data: Record<string, unknown>, delay: number) => {
    const timer = window.setTimeout(() => {
      if (!stopped) onEvent({ type, at: Date.now(), ...data } as PrismEvent);
    }, delay);
    timers.push(timer);
  };

  const stage = (id: string, status: string, detail: string, delay: number) => {
    emit('stage', { id, status, detail }, delay);
  };

  emit('stages', { stages: demoStages }, 0);
  stage('planner', 'running', '正在把课题拆成检索式与分析视角', 350);
  emit('plan', { plan: fixture.plan }, 1750);
  stage('planner', 'done', `${fixture.plan.queries.length} 条检索式 · ${fixture.plan.dimensions.length} 个分析视角`, 1800);

  stage('semanticscholar', 'running', '正在检索 Semantic Scholar · 引用感知学术图谱', 2000);
  stage('doaj', 'running', '正在检索 DOAJ · 开放获取期刊', 2100);
  stage('crossref', 'running', '正在检索 Crossref · DOI 元数据', 2200);
  const sourceDetail = (id: string) => {
    const source = sourceById(id);
    return `${source?.count || 0} 条记录 · ${((source?.ms || 0) / 1000).toFixed(1)} 秒`;
  };
  stage('semanticscholar', 'done', sourceDetail('semanticscholar'), 3000);
  stage('doaj', 'done', sourceDetail('doaj'), 3300);
  stage('crossref', 'done', sourceDetail('crossref'), 3600);

  emit('papers', { papers: fixture.papers, sources: fixture.sources, stats: fixture.stats }, 3900);
  stage('analyst', 'queued', `${fixture.papers.length} 篇候选已排序 · ${fixture.stats.withAbstract} 篇有摘要`, 4000);
  stage('analyst', 'running', `正在从 ${fixture.papers.length} 篇文献中抽取论点与局限`, 4300);
  emit('analysis', { analysis: fixture.analysis }, 7200);
  stage('analyst', 'done', `${fixture.papers.length} 篇文献 · ${fixture.analysis.themes.length} 个主题 · ${fixture.analysis.gaps.length} 个缺口`, 7300);

  stage('synthesizer', 'running', '正在连接主题、分歧与未解问题', 7600);
  emit('brief', { brief: fixture.brief }, 9000);
  stage('synthesizer', 'done', `${fixture.brief.keyThemes.length} 个主题 · ${fixture.brief.painPoints.length} 个未解问题`, 9100);

  stage('critic', 'running', '正在检查引用、摘要覆盖率与缺口来源', 9400);
  emit('review', { quality: fixture.quality }, 10500);
  stage('critic', 'done', `${confidenceLabel(fixture.quality.confidence)} · 5/5 项检查`, 10600);
  emit('usage', { label: 'demo', ...fixture.quality.tokens }, 10800);

  emit('done', { result: fixture }, 11500);

  return () => {
    stopped = true;
    timers.forEach(timer => window.clearTimeout(timer));
  };
}
