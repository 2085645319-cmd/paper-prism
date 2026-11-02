import { createDeepSeek } from '../lib/deepseek.mjs';
import { rankRelated } from '../lib/normalize.mjs';
import { searchSemanticScholar } from '../providers/semanticscholar.mjs';
import { searchCrossref } from '../providers/crossref.mjs';

const DEFAULT_FOLLOW_UPS = [
  '这个方向过去有哪些经典工作？',
  '再帮我找一些 2025–2026 年的新文章',
  '这些方法里哪个更适合落地？'
];

function compactBrief(brief) {
  if (!brief) return null;
  return {
    title: brief.title,
    standfirst: brief.standfirst,
    scope: brief.scope,
    keyThemes: brief.keyThemes.map(theme => ({ name: theme.name, insight: theme.insight })),
    consensus: brief.consensus,
    tensions: brief.tensions,
    painPoints: brief.painPoints.map(pain => ({ title: pain.title, detail: pain.detail, opportunity: pain.opportunity })),
    futureDirections: brief.futureDirections,
    readingPath: brief.readingPath
  };
}

function paperLine(paper) {
  return {
    id: paper.id,
    title: paper.title,
    year: paper.year,
    venue: paper.venue,
    doi: paper.doi,
    url: paper.url,
    abstract: String(paper.abstract || '').slice(0, 220)
  };
}

function detectIntent(question) {
  const asksPapers = /论文|文章|文献|paper|literature|reference|工作/i.test(question);
  const asksHistory = /过去|早期|经典|历史|奠基|seminal|classic|before|older|prior|201\d|2020/i.test(question);
  const asksRecent = /更多|再找|补充|近年|最近|最新|newer|recent|latest|2025|2026/i.test(question);
  const asksFind = /找|搜|推荐|给我|find|search|show/i.test(question);
  if (asksHistory) return 'historical';
  if (asksRecent && (asksPapers || asksFind)) return 'recent';
  if (asksPapers && asksFind) return 'corpus';
  return 'general';
}

async function fetchRelated(result, mode) {
  if (!['historical', 'recent'].includes(mode)) return [];
  const plan = result.plan;
  const currentYear = new Date().getFullYear();
  const yearFrom = mode === 'historical' ? currentYear - 30 : currentYear - 3;
  const yearTo = mode === 'historical' ? currentYear - 6 : currentYear;
  const query = mode === 'historical'
    ? plan.topic_en.replace(/\blarge language models?\b/gi, '').replace(/\bLLMs?\b/gi, '').replace(/\s+/g, ' ').trim()
    : plan.queries?.[0] || plan.topic_en;
  const exclude = result.papers.flatMap(paper => [paper.doi, paper.title]).filter(Boolean);

  const settled = await Promise.allSettled([
    searchSemanticScholar(query, 30, { yearFrom, yearTo }),
    searchCrossref(query, 20, { yearFrom, yearTo })
  ]);
  const raw = settled.flatMap(item => item.status === 'fulfilled' ? item.value : []);
  const papers = rankRelated(raw, { plan, yearFrom, yearTo, max: 6, exclude });
  return papers.map(paper => ({
    ...paper,
    why: `${paper.year || '年份未注'} 年 · ${paper.citations.toLocaleString()} 次引用${paper.abstract ? ' · 摘要可用' : ' · 仅题录'}`
  }));
}

function fallbackAnswer(result, mode, related) {
  const title = result.brief?.title || result.topic;
  const themes = result.brief?.keyThemes?.slice(0, 3).map(item => item.name).join('、') || '当前主题';
  const base = `当前简报《${title}》主要围绕 ${themes} 展开。`;
  if (related.length) {
    return `${base}\n\n我补查了 ${mode === 'historical' ? '更早的' : '近年的'}相关工作，找到 ${related.length} 篇可以作为补充阅读的论文。你先看下面的标题和年份，判断是否有你需要的历史脉络；需要我继续展开某一篇，直接告诉我。`;
  }
  if (mode === 'historical' || mode === 'recent') {
    return `${base}\n\n这次补充检索没有拿到可用的${mode === 'historical' ? '早期' : '近年'}论文。可以换一个更具体的子方向，或让我用英文检索式再试一次。`;
  }
  return `${base}\n\n你可以继续问我：过去有没有经典工作、再找一些近年文章、这些方法哪个适合落地，或者让我给出 3 个可继续做的研究切口。`;
}

export async function answerFollowUp({ result, question, history = [] }) {
  if (!result?.brief) throw new Error('当前研究尚未完成。');
  const mode = detectIntent(question);
  const related = await fetchRelated(result, mode);
  const corpusPapers = result.papers.map(paperLine);
  const messages = history
    .filter(item => ['user', 'assistant'].includes(item.role) && item.content)
    .slice(-8)
    .map(item => ({ role: item.role, content: String(item.content).slice(0, 1200) }));

  const llm = createDeepSeek();
  if (!llm.available) {
    return { answer: fallbackAnswer(result, mode, related), followUps: DEFAULT_FOLLOW_UPS, papers: related, mode };
  }

  const system = `你是 PRISM 的研究对话助手。用户已经完成一次文献研究，现在是在当前结果上继续追问，不是重新开始一次检索。

规则：
- 用简体中文回答，语气像研究助理，直接、具体、不要复述整篇简报。
- 只能使用 CURRENT_PAPERS、RELATED_PAPERS 和 BRIEF 中的信息；绝对不要编造论文标题、作者、DOI、数字或引用。
- CURRENT_PAPERS 是当前近五年语料；RELATED_PAPERS 是针对“过去/早期”或“更多近年”问题补充检索到的论文。
- 如果用户问过去/经典工作，明确说明补充检索找到了几篇、年份范围是什么；如果没找到，就直说。
- 如果用户问落地/研究切口，结合简报中的未解问题，给出可执行的 2–3 个方向，不要空泛。
- 回答中可以使用 CURRENT_PAPERS 的编号 [P1] 或 RELATED_PAPERS 的编号 [R1]，但不要虚构编号。
- 只返回一个 JSON 对象：{"answer":"中文回答","followUps":["3 个简短的中文追问建议"]}。`;

  const user = JSON.stringify({
    current_topic: result.topic,
    current_papers: corpusPapers,
    brief: compactBrief(result.brief),
    related_papers: related,
    intent: mode,
    question,
    recent_conversation: messages
  });

  try {
    const data = await llm.json({
      system,
      user,
      maxTokens: 2400,
      temperature: 0.3,
      label: 'chat'
    });
    const answer = String(data?.answer || '').trim();
    if (!answer) throw new Error('模型没有返回回答。');
    const followUps = Array.isArray(data?.followUps)
      ? data.followUps.map(item => String(item)).filter(Boolean).slice(0, 3)
      : DEFAULT_FOLLOW_UPS;
    return { answer, followUps: followUps.length ? followUps : DEFAULT_FOLLOW_UPS, papers: related, mode };
  } catch {
    return { answer: fallbackAnswer(result, mode, related), followUps: DEFAULT_FOLLOW_UPS, papers: related, mode };
  }
}
