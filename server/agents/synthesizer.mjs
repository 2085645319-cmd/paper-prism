import { SYNTHESIZER_SYSTEM, synthesizerUser } from '../lib/prompts.mjs';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const list = value => (Array.isArray(value) ? value : []);

function fallbackBrief(topic, papers, analysis) {
  const top = [...papers].sort((a, b) => b.citations - a.citations).slice(0, 6);
  return {
    title: topic,
    standfirst: `基于 ${papers.length} 篇检索文献的证据摘要；AI 综合暂不可用。`,
    scope: `本次检索覆盖 ${papers.length} 篇文献，按相关度、引用信号和摘要完整度筛选。以下内容只整理已检索到的证据，不代表领域全貌。`,
    keyThemes: list(analysis.themes).map(theme => ({
      name: theme.name,
      insight: theme.summary,
      paperIds: theme.paperIds
    })),
    consensus: list(analysis.consensus),
    tensions: list(analysis.tensions),
    painPoints: list(analysis.gaps).map(gap => ({
      title: gap.title,
      detail: gap.detail,
      evidenceIds: gap.evidenceIds,
      opportunity: '需要设计可复现的实验或系统评估来验证这一缺口。'
    })),
    futureDirections: [],
    readingPath: top.map(paper => ({
      paperId: paper.id,
      why: paper.citations
        ? `被引 ${paper.citations} 次，可作为进入该方向的锚点。`
        : '与检索主题直接相关，建议优先核对原文。'
    })),
    methodNotes: ['检索 Semantic Scholar、DOAJ 与 Crossref，按 DOI/标题去重后排序。'],
    caveats: ['AI 综合不可用，当前为启发式摘要。', '摘要缺失的文献只按标题与元数据归类。'],
    mode: 'heuristic'
  };
}

function normalize(raw, topic, papers, analysis) {
  const fallback = fallbackBrief(topic, papers, analysis);
  const validIds = new Set(papers.map(p => p.id));

  const themes = list(raw?.keyThemes)
    .map(theme => ({
      name: clean(theme?.name),
      insight: clean(theme?.insight),
      paperIds: list(theme?.paperIds).filter(id => validIds.has(id))
    }))
    .filter(theme => theme.name && theme.insight && theme.paperIds.length > 0)
    .slice(0, 5);

  const painPoints = list(raw?.painPoints)
    .map(item => ({
      title: clean(item?.title),
      detail: clean(item?.detail),
      evidenceIds: list(item?.evidenceIds).filter(id => validIds.has(id)),
      opportunity: clean(item?.opportunity)
    }))
    .filter(item => item.title && item.detail)
    .slice(0, 5);

  const futureDirections = list(raw?.futureDirections)
    .map(item => ({
      title: clean(item?.title),
      detail: clean(item?.detail),
      evidenceIds: list(item?.evidenceIds).filter(id => validIds.has(id))
    }))
    .filter(item => item.title && item.detail)
    .slice(0, 4);

  const readingPath = list(raw?.readingPath)
    .map(item => ({ paperId: item?.paperId, why: clean(item?.why) }))
    .filter(item => validIds.has(item.paperId) && item.why)
    .slice(0, 7);

  return {
    title: clean(raw?.title) || fallback.title,
    standfirst: clean(raw?.standfirst) || fallback.standfirst,
    scope: clean(raw?.scope) || fallback.scope,
    keyThemes: themes.length ? themes : fallback.keyThemes,
    consensus: list(raw?.consensus).map(clean).filter(Boolean).slice(0, 5),
    tensions: list(raw?.tensions).map(clean).filter(Boolean).slice(0, 5),
    painPoints: painPoints.length ? painPoints : fallback.painPoints,
    futureDirections: futureDirections.length ? futureDirections : fallback.futureDirections,
    readingPath: readingPath.length >= 3 ? readingPath : fallback.readingPath,
    methodNotes: list(raw?.methodNotes).map(clean).filter(Boolean).slice(0, 5),
    caveats: list(raw?.caveats).map(clean).filter(Boolean).slice(0, 5),
    mode: 'llm'
  };
}

export async function runSynthesizer({ topic, plan, papers, analysis, llm, job }) {
  job.emit('stage', {
    id: 'synthesizer',
    status: 'running',
    detail: '正在连接主题、分歧与未解问题'
  });

  if (!llm.available || analysis.mode === 'heuristic') {
    return fallbackBrief(topic, papers, analysis);
  }

  try {
    const raw = await llm.json({
      system: SYNTHESIZER_SYSTEM,
      user: synthesizerUser(topic, plan, papers, analysis),
      maxTokens: 5000,
      temperature: 0.3,
      label: 'synthesizer'
    });
    return normalize(raw, topic, papers, analysis);
  } catch (error) {
    job.emit('warning', {
      message: '综合编辑已降级，展示启发式摘要。',
      detail: '上游综合模型暂时不可用。'
    });
    return fallbackBrief(topic, papers, analysis);
  }
}
