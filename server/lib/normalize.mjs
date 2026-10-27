function normalizeTitle(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleKey(title = '') {
  return normalizeTitle(title).split(' ').slice(0, 22).join(' ');
}

const STOP = new Set('the a an and or of for to in on with from by is are was were be as at this that these those using based toward towards study research paper approach method methods analysis new novel via we our their its it can could may might not no more than into between across under over about'.split(' '));

function tokenize(text = '') {
  return new Set(
    String(text)
      .toLowerCase()
      .match(/[a-z][a-z-]{2,}|[\u4e00-\u9fff]{2,}/g)
      ?.filter(token => !STOP.has(token)) || []
  );
}

function jaccard(a, b) {
  const left = tokenize(a);
  const right = tokenize(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function contextTerms(plan) {
  if (!plan) return new Set();
  return tokenize([plan.topic_en, plan.field, ...(plan.queries || [])].join(' '));
}

function relevance(paper, terms) {
  if (!terms.size) return 0;
  const title = tokenize(paper.title);
  const abstract = tokenize(paper.abstract);
  let hits = 0;
  for (const term of terms) {
    if (title.has(term)) hits += 2;
    else if (abstract.has(term)) hits += 1;
  }
  return hits / Math.sqrt(terms.size * 6);
}

export function mergePapers(rawPapers) {
  const byKey = new Map();
  for (const raw of rawPapers) {
    if (!raw?.title) continue;
    const doi = raw.doi ? String(raw.doi).toLowerCase().replace(/^https?:\/\/doi.org\//, '') : '';
    let key = doi || titleKey(raw.title);
    if (!doi) {
      // Catch near-duplicate titles that differ only in subtitle punctuation or a preprint suffix.
      for (const candidate of byKey.values()) {
        if (jaccard(candidate.title, raw.title) > 0.82) {
          key = candidate.doi || titleKey(candidate.title);
          break;
        }
      }
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...raw,
        doi: doi || null,
        sources: new Set(raw.source ? [raw.source] : []),
        url: raw.url || (doi ? `https://doi.org/${doi}` : '')
      });
      continue;
    }
    if (raw.source) existing.sources.add(raw.source);
    existing.citations = Math.max(existing.citations || 0, raw.citations || 0);
    existing.openAccess = Boolean(existing.openAccess || raw.openAccess);
    if ((raw.abstract || '').length > (existing.abstract || '').length) existing.abstract = raw.abstract;
    if (!existing.year && raw.year) existing.year = raw.year;
    if (!existing.venue && raw.venue) existing.venue = raw.venue;
    if ((raw.authors || []).length > (existing.authors || []).length) existing.authors = raw.authors;
    if (!existing.url && raw.url) existing.url = raw.url;
    if (!existing.doi && raw.doi) existing.doi = raw.doi;
  }
  return [...byKey.values()];
}

function scorePaper(paper, terms) {
  const citations = Math.max(0, paper.citations || 0);
  const year = paper.year || 0;
  const age = year ? new Date().getFullYear() - year : 8;
  const recency = Math.max(0, 3.2 - age * 0.28);
  const abstract = paper.abstract ? Math.min(1.8, paper.abstract.length / 900) : 0;
  const sources = paper.sources ? paper.sources.size : 1;
  return Math.log1p(citations) * 1.8 + recency * 0.8 + abstract * 0.8 + Math.min(1.2, sources * 0.35) + relevance(paper, terms) * 2.4;
}

export function rankAndSelect(rawPapers, max = 18, plan = null) {
  const merged = mergePapers(rawPapers);
  const terms = contextTerms(plan);
  const scored = merged
    .map(paper => ({ ...paper, _score: scorePaper(paper, terms) }))
    .sort((a, b) => b._score - a._score);

  // Keep the head of the ranking but guarantee a few recent papers.
  const selected = scored.slice(0, max);
  const recent = scored.filter(p => p.year && new Date().getFullYear() - p.year <= 3);
  for (const paper of recent.slice(0, 4)) {
    if (!selected.includes(paper)) {
      const replaceAt = selected.map(p => p.year || 0).lastIndexOf(Math.min(...selected.map(p => p.year || 0)));
      if (replaceAt >= 0) selected.splice(replaceAt, 1, paper);
    }
  }

  const maxScore = Math.max(...selected.map(p => p._score), 1);
  return selected
    .sort((a, b) => b._score - a._score)
    .map((paper, index) => ({
      id: `P${index + 1}`,
      title: paper.title,
      authors: paper.authors || [],
      year: paper.year || null,
      venue: paper.venue || '',
      doi: paper.doi || null,
      url: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : ''),
      abstract: paper.abstract || '',
      citations: Math.max(0, paper.citations || 0),
      sources: [...(paper.sources || [])],
      type: paper.type || 'article',
      openAccess: Boolean(paper.openAccess),
      signal: Math.round(38 + 57 * (paper._score / maxScore))
    }));
}

export function corpusStats(papers) {
  const years = papers.map(p => p.year).filter(Boolean);
  return {
    papers: papers.length,
    withAbstract: papers.filter(p => p.abstract && p.abstract.length > 80).length,
    openAccess: papers.filter(p => p.openAccess).length,
    citations: papers.reduce((sum, p) => sum + (p.citations || 0), 0),
    yearMin: years.length ? Math.min(...years) : null,
    yearMax: years.length ? Math.max(...years) : null
  };
}
