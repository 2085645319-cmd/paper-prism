import { createDeepSeek } from '../lib/deepseek.mjs';
import { corpusStats, rankAndSelect } from '../lib/normalize.mjs';
import { CONFIG } from '../config.mjs';
import { runPlanner } from './planner.mjs';
import { runScouts } from './scout.mjs';
import { runAnalyst } from './analyst.mjs';
import { runSynthesizer } from './synthesizer.mjs';
import { runCritic } from './critic.mjs';

export const AGENT_STAGES = [
  { id: 'planner', name: '规划智能体', role: '拆解研究问题', short: 'PLAN' },
  { id: 'semanticscholar', name: 'Semantic Scholar 检索', role: '引用感知学术图谱', short: 'SCAN' },
  { id: 'doaj', name: 'DOAJ 检索', role: '开放获取期刊', short: 'SCAN' },
  { id: 'crossref', name: 'Crossref 检索', role: 'DOI 元数据', short: 'SCAN' },
  { id: 'analyst', name: '证据分析', role: '抽取论点与局限', short: 'READ' },
  { id: 'synthesizer', name: '综合编辑', role: '归纳主题与未解问题', short: 'SYNTH' },
  { id: 'critic', name: '引用核查', role: '复核证据链', short: 'CHECK' }
];

const CONFIDENCE_CN = { high: '高', medium: '中', low: '低' };

export async function runResearch(job) {
  const startedAt = Date.now();
  const tokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const llm = createDeepSeek({
    onUsage: usage => {
      tokens.promptTokens += usage.promptTokens;
      tokens.completionTokens += usage.completionTokens;
      tokens.totalTokens += usage.totalTokens;
      job.emit('usage', usage);
    }
  });

  job.emit('stages', {
    stages: AGENT_STAGES.map(stage => ({ ...stage, status: 'queued', detail: stage.role }))
  });
  job.emit('meta', {
    startedAt,
    model: CONFIG.deepseekModel,
    llm: llm.available,
    sources: ['Semantic Scholar', 'DOAJ', 'Crossref']
  });

  try {
    const plan = await runPlanner({ topic: job.topic, llm, job });
    job.emit('stage', {
      id: 'planner',
      status: 'done',
      detail: `${plan.queries.length} 条检索式 · ${plan.dimensions.length} 个分析视角`
    });
    job.emit('plan', { plan });

    const { papers: rawPapers, sources } = await runScouts({ plan, job });
    const papers = rankAndSelect(rawPapers, CONFIG.maxPapers, plan);
    const stats = corpusStats(papers);

    if (!papers.length) {
      throw new Error('Semantic Scholar、DOAJ 与 Crossref 都没有返回文献记录，请尝试更宽泛的课题。');
    }

    job.emit('papers', { papers, sources, stats });
    job.emit('stage', {
      id: 'analyst',
      status: 'queued',
      detail: `${papers.length} 篇候选已排序 · ${stats.withAbstract} 篇有摘要`
    });

    const analysis = await runAnalyst({ topic: job.topic, plan, papers, llm, job });
    job.emit('stage', {
      id: 'analyst',
      status: 'done',
      detail: `${papers.length} 篇文献 · ${analysis.themes.length} 个主题 · ${analysis.gaps.length} 个缺口`
    });
    job.emit('analysis', { analysis });

    const brief = await runSynthesizer({ topic: job.topic, plan, papers, analysis, llm, job });
    job.emit('stage', {
      id: 'synthesizer',
      status: 'done',
      detail: `${brief.keyThemes.length} 个主题 · ${brief.painPoints.length} 个未解问题`
    });
    job.emit('brief', { brief });

    job.emit('stage', { id: 'critic', status: 'running', detail: '正在检查引用、覆盖率和结论边界' });
    const quality = runCritic({ brief, papers, sources, analysis, tokens, startedAt });
    job.emit('stage', {
      id: 'critic',
      status: 'done',
      detail: `${CONFIDENCE_CN[quality.confidence] || quality.confidence}置信度 · ${quality.checks.filter(c => c.status === 'pass').length}/${quality.checks.length} 项检查`
    });
    job.emit('review', { quality });

    const result = {
      topic: job.topic,
      plan,
      papers,
      analysis,
      brief,
      quality,
      stats,
      sources,
      meta: {
        startedAt,
        durationMs: Date.now() - startedAt,
        model: CONFIG.deepseekModel,
        llm: llm.available,
        generatedAt: new Date().toISOString()
      }
    };

    job.complete(result);
  } catch (error) {
    job.fail(error);
  }
}
