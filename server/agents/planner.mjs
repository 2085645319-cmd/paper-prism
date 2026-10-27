import { PLANNER_SYSTEM, plannerUser } from '../lib/prompts.mjs';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

export function fallbackPlan(topic) {
  const base = clean(topic);
  return {
    topic_en: base,
    field: '跨学科研究',
    queries: [
      `${base} survey`,
      `${base} methods`,
      `${base} challenges limitations`,
      `${base} benchmark evaluation`,
      `${base} future directions`
    ],
    dimensions: [
      { name: '基础', question: '这个领域由哪些定义、假设与理论框架组织起来？' },
      { name: '方法', question: '哪些方法与数据集占主导？它们的盲点是什么？' },
      { name: '证据', question: '哪些结论真正被证明了？证据强度如何？' },
      { name: '前沿', question: '哪些问题仍然开放或存在争议？' }
    ]
  };
}

function normalizePlan(raw, topic) {
  const fallback = fallbackPlan(topic);
  const queries = Array.isArray(raw?.queries)
    ? raw.queries.map(clean).filter(Boolean)
    : [];
  const dimensions = Array.isArray(raw?.dimensions)
    ? raw.dimensions
        .map(item => ({ name: clean(item?.name), question: clean(item?.question) }))
        .filter(item => item.name && item.question)
    : [];
  const uniqueQueries = [...new Set(queries)].slice(0, 5);
  while (uniqueQueries.length < 5) {
    uniqueQueries.push(fallback.queries[uniqueQueries.length]);
  }
  return {
    topic_en: clean(raw?.topic_en) || fallback.topic_en,
    field: clean(raw?.field) || fallback.field,
    queries: uniqueQueries,
    dimensions: dimensions.length >= 3 ? dimensions.slice(0, 4) : fallback.dimensions
  };
}

export async function runPlanner({ topic, llm, job }) {
  job.emit('stage', {
    id: 'planner',
    status: 'running',
    detail: '正在把课题拆成检索式与分析视角'
  });

  if (!llm.available) {
    const plan = fallbackPlan(topic);
    job.emit('warning', { message: '未配置 DeepSeek Key，使用确定性检索计划。' });
    return plan;
  }

  try {
    const raw = await llm.json({
      system: PLANNER_SYSTEM,
      user: plannerUser(topic),
      maxTokens: 1000,
      temperature: 0.2,
      label: 'planner'
    });
    return normalizePlan(raw, topic);
  } catch (error) {
    job.emit('warning', {
      message: '规划智能体已降级。',
      detail: '上游规划模型暂时不可用。'
    });
    return fallbackPlan(topic);
  }
}
