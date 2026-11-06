const NOT_STATED = /not stated|not explicitly|no explicit|not reported|not available|未说明|未明确|未提及|没有明确/i;

const PROVENANCE_SYSTEM = `You are a meticulous research auditor. Your job is to distinguish three kinds of research gaps:
1. "author-stated": an author explicitly acknowledges a limitation in the supplied abstract that directly matches the gap.
2. "cross-paper": the gap follows from the combined findings of two or more papers, but no author explicitly names it as their own limitation.
3. "model-inferred": the gap is a reasonable synthesis but is not directly grounded in the supplied abstracts.

Rules:
- Use only the supplied abstracts. Never use outside knowledge.
- For "author-stated", every quote must be copied VERBATIM from that paper's abstract, character for character. Do not paraphrase, translate, or merge sentences.
- A paper being cited by the gap is not enough. The quoted sentence itself must directly acknowledge the limitation.
- If unsure, choose "cross-paper" or "model-inferred" rather than "author-stated".
- Return valid JSON only, with this shape:
{"gaps":[{"index":1,"kind":"author-stated|cross-paper|model-inferred","quotes":[{"paperId":"P7","quote":"verbatim sentence"}]}]}
- For non-author-stated gaps, quotes must be an empty array.
- Each gap may have at most 2 quotes.`;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isMeaningfulLimitation(text) {
  const value = String(text || '').trim();
  return value.length >= 18 && !NOT_STATED.test(value);
}

function evidencePaperBlock(paper, insight, maxChars = 1500) {
  const abstract = normalizeText(paper.abstract).slice(0, maxChars) || '(no abstract)';
  const limitation = isMeaningfulLimitation(insight?.limitation)
    ? normalizeText(insight.limitation).slice(0, 420)
    : '(no explicit limitation extracted)';
  return `[${paper.id}] ${paper.title} (${paper.year || 'year unknown'})
EXTRACTED LIMITATION HINT: ${limitation}
ABSTRACT: ${abstract}`;
}

function buildPrompt(topic, brief, evidencePapers, analysis) {
  const gapLines = brief.painPoints.map((pain, index) => {
    const citedFindings = (pain.evidenceIds || [])
      .map(id => analysis?.papers?.[id]?.finding)
      .filter(Boolean)
      .map(finding => normalizeText(finding).slice(0, 180))
      .join(' | ') || 'none';
    return `${index + 1}. ${pain.title}
DETAIL: ${pain.detail}
CITED: ${(pain.evidenceIds || []).join(', ') || 'none'}
CITED FINDINGS: ${citedFindings}`;
  }).join('\n\n');

  return `Topic: ${topic}

GAPS TO AUDIT:
${gapLines}

EVIDENCE PAPERS:
${evidencePapers.join('\n\n')}

Audit each gap. The "EXTRACTED LIMITATION HINT" is only a hint from an earlier model — trust only the actual abstract text. Return JSON with one entry per gap, in order.`;
}

function fallbackProvenance(pain, papers) {
  const evidenceIds = [...new Set(pain.evidenceIds || [])].filter(id => papers.some(paper => paper.id === id));
  if (evidenceIds.length >= 2) {
    return {
      kind: 'cross-paper',
      label: '跨论文空白',
      strength: evidenceIds.length >= 4 ? 'medium' : 'weak',
      summary: `综合当前 ${papers.length} 篇文献：${evidenceIds.length} 篇与该问题相关，但没有完成作者原句核对。`,
      quotes: [],
      involvedCount: evidenceIds.length,
      paperCount: papers.length
    };
  }
  return {
    kind: 'model-inferred',
    label: '模型推断',
    strength: 'weak',
    summary: '模型根据主题结构与文献空白推断；当前语料没有直接的作者表述。',
    quotes: [],
    involvedCount: evidenceIds.length,
    paperCount: papers.length
  };
}

function normalizeProvenance(entry, pain, papers, analysis) {
  const paperById = new Map(papers.map(paper => [paper.id, paper]));
  const evidenceIds = [...new Set(pain.evidenceIds || [])].filter(id => paperById.has(id));
  const kind = ['author-stated', 'cross-paper', 'model-inferred'].includes(entry?.kind)
    ? entry.kind
    : 'model-inferred';

  const quotes = [];
  const seen = new Set();
  for (const item of Array.isArray(entry?.quotes) ? entry.quotes : []) {
    const paperId = String(item?.paperId || '');
    const quote = normalizeText(item?.quote);
    const paper = paperById.get(paperId);
    if (!paper || !evidenceIds.includes(paperId)) continue;
    if (quote.length < 24 || quote.length > 600) continue;
    const abstract = normalizeText(paper.abstract);
    if (!abstract.includes(quote)) continue;
    const key = `${paperId}:${quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    quotes.push({ paperId, quote });
    if (quotes.length >= 2) break;
  }

  if (kind === 'author-stated' && quotes.length) {
    const ids = quotes.map(item => item.paperId).join('、');
    return {
      kind: 'author-stated',
      label: '作者自述',
      strength: 'strong',
      summary: `来自 ${ids} 的作者在摘要中明确提到的局限；点击编号可回到原文核对。`,
      quotes,
      involvedCount: evidenceIds.length,
      paperCount: papers.length
    };
  }

  if (evidenceIds.length >= 2) {
    return {
      kind: 'cross-paper',
      label: '跨论文空白',
      strength: evidenceIds.length >= 4 ? 'medium' : 'weak',
      summary: `综合当前 ${papers.length} 篇文献：${evidenceIds.length} 篇与该问题相关，但没有一篇在摘要中把它明确列为自身局限。`,
      quotes: [],
      involvedCount: evidenceIds.length,
      paperCount: papers.length
    };
  }

  return {
    kind: 'model-inferred',
    label: '模型推断',
    strength: 'weak',
    summary: '模型根据主题结构与文献空白推断；当前语料没有直接的作者表述，建议打开原文核实。',
    quotes: [],
    involvedCount: evidenceIds.length,
    paperCount: papers.length
  };
}

export async function withGapProvenance(brief, analysis, papers, llm, job) {
  if (!brief?.painPoints?.length) return brief;

  const fallback = () => ({
    ...brief,
    painPoints: brief.painPoints.map(pain => ({
      ...pain,
      provenance: fallbackProvenance(pain, papers)
    }))
  });

  if (!llm?.available || analysis?.mode === 'heuristic') return fallback();

  const evidenceIds = new Set(brief.painPoints.flatMap(pain => pain.evidenceIds || []));
  const evidencePapers = papers
    .filter(paper => evidenceIds.has(paper.id))
    .map(paper => evidencePaperBlock(paper, analysis?.papers?.[paper.id]));
  if (!evidencePapers.length) return fallback();

  try {
    const raw = await llm.json({
      system: PROVENANCE_SYSTEM,
      user: buildPrompt(job?.topic || '', brief, evidencePapers, analysis),
      maxTokens: 2200,
      temperature: 0.1,
      label: 'gap-provenance'
    });
    if (!Array.isArray(raw?.gaps)) return fallback();
    return {
      ...brief,
      painPoints: brief.painPoints.map((pain, index) => {
        const entry = raw.gaps.find(item => Number(item?.index) === index + 1);
        return {
          ...pain,
          provenance: entry
            ? normalizeProvenance(entry, pain, papers, analysis)
            : fallbackProvenance(pain, papers)
        };
      })
    };
  } catch (error) {
    job?.emit('warning', {
      message: '缺口来源判定已降级',
      detail: '没有完成作者原句核对，当前按语料覆盖度标注。'
    });
    return fallback();
  }
}
