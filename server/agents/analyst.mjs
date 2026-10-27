import { ANALYST_SYSTEM, analystUser } from '../lib/prompts.mjs';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const validId = id => /^P\d+$/.test(String(id));

function firstSentences(text, count = 2) {
  const cleanText = clean(text);
  if (!cleanText) return [];
  const parts = cleanText.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  return parts.slice(0, count);
}

function topKeywords(papers, limit = 8) {
  const stop = new Set('the a an and or of for to in on with from by is are was were be as at this that these those using based toward towards study research paper approach method methods analysis new novel via'.split(' '));
  const counts = new Map();
  for (const paper of papers) {
    for (const word of `${paper.title} ${paper.abstract}`.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []) {
      if (stop.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export function fallbackAnalysis(papers) {
  const paperMap = {};
  for (const paper of papers) {
    const points = firstSentences(paper.abstract, 2);
    paperMap[paper.id] = {
      keyPoints: points.length ? points : [paper.title],
      method: '现有元数据未说明',
      finding: points[0] || '现有元数据未说明',
      limitation: '现有元数据未说明'
    };
  }
  const themes = papers.length >= 2
    ? [{
        name: '语料总览',
        summary: `对 ${papers.length} 条检索记录做启发式归纳。由于 AI 综合暂不可用，这里只做语料分组，不声称存在跨论文共识。`,
        paperIds: papers.map(p => p.id)
      }]
    : [];
  return {
    papers: paperMap,
    themes,
    consensus: [],
    tensions: [],
    gaps: [],
    keywords: topKeywords(papers),
    mode: 'heuristic'
  };
}

function normalize(raw, papers) {
  const fallback = fallbackAnalysis(papers);
  const validIds = new Set(papers.map(p => p.id));
  const source = raw?.papers && typeof raw.papers === 'object' ? raw.papers : {};
  const paperMap = {};

  for (const paper of papers) {
    const item = source[paper.id] || {};
    const keyPoints = Array.isArray(item.keyPoints)
      ? item.keyPoints.map(clean).filter(Boolean).slice(0, 4)
      : [];
    paperMap[paper.id] = {
      keyPoints: keyPoints.length ? keyPoints : fallback.papers[paper.id].keyPoints,
      method: clean(item.method) || fallback.papers[paper.id].method,
      finding: clean(item.finding) || fallback.papers[paper.id].finding,
      limitation: clean(item.limitation) || fallback.papers[paper.id].limitation
    };
  }

  const themes = (Array.isArray(raw?.themes) ? raw.themes : [])
    .map(theme => ({
      name: clean(theme?.name),
      summary: clean(theme?.summary),
      paperIds: (Array.isArray(theme?.paperIds) ? theme.paperIds : []).filter(id => validIds.has(id))
    }))
    .filter(theme => theme.name && theme.summary && theme.paperIds.length >= 2)
    .slice(0, 5);

  const gaps = (Array.isArray(raw?.gaps) ? raw.gaps : [])
    .map(gap => ({
      title: clean(gap?.title),
      detail: clean(gap?.detail),
      evidenceIds: (Array.isArray(gap?.evidenceIds) ? gap.evidenceIds : []).filter(id => validIds.has(id))
    }))
    .filter(gap => gap.title && gap.detail && gap.evidenceIds.length > 0)
    .slice(0, 5);

  const textList = (value, limit = 5) => (Array.isArray(value) ? value : [])
    .map(clean)
    .filter(Boolean)
    .slice(0, limit);

  return {
    papers: paperMap,
    themes: themes.length ? themes : fallback.themes,
    consensus: textList(raw?.consensus, 4),
    tensions: textList(raw?.tensions, 4),
    gaps: gaps.length ? gaps : fallback.gaps,
    keywords: textList(raw?.keywords, 10).length ? textList(raw?.keywords, 10) : fallback.keywords,
    mode: 'llm'
  };
}

export async function runAnalyst({ topic, plan, papers, llm, job }) {
  job.emit('stage', {
    id: 'analyst',
    status: 'running',
    detail: `正在从 ${papers.length} 篇文献中抽取论点与局限`
  });

  if (!llm.available) {
    return fallbackAnalysis(papers);
  }

  try {
    const raw = await llm.json({
      system: ANALYST_SYSTEM,
      user: analystUser(topic, plan, papers),
      maxTokens: 5600,
      temperature: 0.2,
      label: 'analyst'
    });
    return normalize(raw, papers);
  } catch (error) {
    if (error.code === 'truncated' && papers.length > 12) {
      job.emit('warning', {
        message: '证据分析输出过长，正在用 12 篇文献的紧凑窗口重试。'
      });
      try {
        const raw = await llm.json({
          system: ANALYST_SYSTEM,
          user: analystUser(topic, plan, papers.slice(0, 12)),
          maxTokens: 3800,
          temperature: 0.2,
          label: 'analyst-retry'
        });
        return normalize(raw, papers);
      } catch (retryError) {
        job.emit('warning', {
          message: '证据分析已降级，简报将使用启发式摘要。',
          detail: '重试仍未完成。'
        });
        return fallbackAnalysis(papers);
      }
    }
    job.emit('warning', {
      message: '证据分析已降级，简报将使用启发式摘要。',
      detail: '上游分析模型暂时不可用。'
    });
    return fallbackAnalysis(papers);
  }
}
