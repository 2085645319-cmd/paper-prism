function collectCitations(value, out = []) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\[P(\d+)\]/g)) out.push(`P${match[1]}`);
  } else if (Array.isArray(value)) {
    for (const item of value) collectCitations(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectCitations(item, out);
  }
  return out;
}

export function runCritic({ brief, papers, sources, analysis, tokens, startedAt }) {
  const ids = new Set(papers.map(p => p.id));
  const cited = [...new Set(collectCitations(brief))];
  const invalid = cited.filter(id => !ids.has(id));
  const readingPathValid = brief.readingPath.every(item => ids.has(item.paperId));
  const abstractCoverage = papers.length
    ? papers.filter(p => p.abstract && p.abstract.length > 80).length / papers.length
    : 0;
  const successfulSources = sources.filter(source => source.status === 'done' && source.count > 0).length;

  const checks = [
    {
      label: '引用解析',
      status: invalid.length ? 'warn' : 'pass',
      detail: invalid.length
        ? `${invalid.length} 条引用未匹配到已检索文献：${invalid.join('、')}`
        : `${cited.length} 条不重复引用全部指向已检索文献。`
    },
    {
      label: '阅读路径',
      status: readingPathValid ? 'pass' : 'warn',
      detail: readingPathValid
        ? `${brief.readingPath.length} 篇文献已排成阅读顺序。`
        : '部分阅读路径条目指向语料之外的文献。'
    },
    {
      label: '摘要覆盖',
      status: abstractCoverage >= 0.55 ? 'pass' : 'warn',
      detail: `入选文献中有 ${Math.round(abstractCoverage * 100)}% 提供可用摘要。`
    },
    {
      label: '来源广度',
      status: successfulSources >= 2 ? 'pass' : 'warn',
      detail: `${sources.length} 个来源中有 ${successfulSources} 个返回记录。`
    },
    {
      label: '综合模式',
      status: brief.mode === 'llm' && analysis.mode === 'llm' ? 'pass' : 'warn',
      detail: brief.mode === 'llm' && analysis.mode === 'llm'
        ? '证据分析与综合均由 DeepSeek 智能体完成。'
        : '一个或多个智能体降级为确定性摘要。'
    }
  ];

  let confidence = 'low';
  if (brief.mode === 'llm' && abstractCoverage >= 0.6 && successfulSources >= 3 && papers.length >= 8) {
    confidence = 'high';
  } else if (brief.mode === 'llm' && abstractCoverage >= 0.35 && papers.length >= 5) {
    confidence = 'medium';
  }

  return {
    confidence,
    checks,
    abstractCoverage: Number(abstractCoverage.toFixed(2)),
    sourceCount: successfulSources,
    paperCount: papers.length,
    citedPapers: cited.length,
    invalidCitations: invalid,
    mode: brief.mode === 'llm' && analysis.mode === 'llm' ? 'llm' : 'heuristic',
    tokens,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt
  };
}
