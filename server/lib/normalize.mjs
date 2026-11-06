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

const GENERIC_TOPIC_TERMS = new Set([
  'large', 'language', 'languages', 'model', 'models', 'system', 'systems',
  'using', 'based', 'approach', 'approaches', 'method', 'methods', 'analysis',
  'research', 'paper', 'study', 'studies', 'novel', 'new', 'toward', 'towards'
]);

function topicAnchors(plan) {
  if (!plan?.topic_en) return [];
  return [...tokenize(plan.topic_en)]
    .filter(term => term.length >= 5 && !GENERIC_TOPIC_TERMS.has(term))
    .slice(0, 6);
}

function anchorHits(paper, anchors) {
  if (!anchors.length) return 0;
  const title = tokenize(paper.title || '');
  const haystack = tokenize(`${paper.title || ''} ${paper.abstract || ''}`);
  const total = anchors.filter(anchor => haystack.has(anchor)).length;
  // Prefer papers whose title itself signals the topic. Generic titles are
  // allowed only through the pool fallback when too few anchored papers exist.
  return anchors.some(anchor => title.has(anchor)) ? total : 0;
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

function scorePaper(paper, terms, abstractWeight = 2.4) {
  const citations = Math.max(0, paper.citations || 0);
  const year = paper.year || 0;
  const currentYear = new Date().getFullYear();
  const age = year ? Math.max(0, currentYear - year) : 8;
  // Evidence-first ranking: abstract quality helps, but title relevance,
  // citations, recency and source overlap keep metadata-only papers eligible.
  const recency = year ? Math.max(0, 4.4 - age * 0.38) : 0;
  const abstractLength = String(paper.abstract || '').trim().length;
  const abstract = abstractLength >= 80 ? Math.min(2.4, abstractLength / 800) : 0;
  const sources = paper.sources ? paper.sources.size : 1;
  return Math.log1p(citations) * 1.05 + recency * 1.9 + abstract * abstractWeight + Math.min(1.2, sources * 0.35) + relevance(paper, terms) * 2.6;
}

function hasUsableAbstract(paper) {
  return String(paper.abstract || '').trim().length >= 80;
}

function selectWithPolicy(pool, count, policy) {
  if (count <= 0) return [];
  if (policy === 'require') return pool.filter(hasUsableAbstract).slice(0, count);
  if (policy === 'ignore') return pool.slice(0, count);

  const withAbstract = pool.filter(hasUsableAbstract);
  const withoutAbstract = pool.filter(paper => !hasUsableAbstract(paper));
  const abstractTarget = Math.ceil(count * 0.7);
  const selected = withAbstract.slice(0, abstractTarget);
  const remaining = count - selected.length;
  if (remaining > 0) {
    selected.push(...withoutAbstract.slice(0, Math.min(remaining, count - abstractTarget)));
  }
  if (selected.length < count) {
    const chosen = new Set(selected);
    for (const paper of pool) {
      if (selected.length >= count) break;
      if (chosen.has(paper)) continue;
      selected.push(paper);
      chosen.add(paper);
    }
  }
  return selected.slice(0, count);
}

export function rankAndSelect(rawPapers, max = 18, plan = null, options = {}) {
  const merged = mergePapers(rawPapers);
  const terms = contextTerms(plan);
  const anchors = topicAnchors(plan);
  const currentYear = new Date().getFullYear();
  const effectiveMax = Math.min(40, Math.max(1, Number(options.maxPapers) || max));
  const yearPreset = options.yearPreset || 'recent5';
  const yearFrom = Number(options.yearFrom) || (yearPreset === 'all' ? 1900 : currentYear - 4);
  const yearTo = Number(options.yearTo) || currentYear;
  const abstractPolicy = options.abstractPolicy
    || (options.requireAbstract === true ? 'require' : options.requireAbstract === false ? 'ignore' : 'prefer');
  const abstractWeight = abstractPolicy === 'require' ? 2.4 : abstractPolicy === 'ignore' ? 0.35 : 1.55;
  const includeClassics = options.includeClassics === true && yearPreset !== 'all';
  const requiredAnchors = Math.min(2, anchors.length);

  const scored = merged
    .map(paper => ({ ...paper, _score: scorePaper(paper, terms, abstractWeight) }))
    .sort((a, b) => b._score - a._score);

  const inWindow = paper => Boolean(paper.year) && paper.year >= yearFrom && paper.year <= yearTo;
  const base = scored.filter(paper => {
    if (!inWindow(paper)) return false;
    if (abstractPolicy === 'require' && !hasUsableAbstract(paper)) return false;
    return true;
  });
  const anchored = requiredAnchors
    ? base.filter(paper => anchorHits(paper, anchors) >= requiredAnchors)
    : base;
  const pool = anchored.length >= Math.min(effectiveMax, 8) ? anchored : base;

  const classicPool = includeClassics
    ? scored.filter(paper => {
        if (!paper.year || paper.year >= yearFrom) return false;
        if (paper.year < yearFrom - 20) return false;
        if (abstractPolicy === 'require' && !hasUsableAbstract(paper)) return false;
        return !requiredAnchors || anchorHits(paper, anchors) >= requiredAnchors;
      }).slice(0, 2)
    : [];

  const recentSlots = Math.max(0, effectiveMax - classicPool.length);
  const selected = selectWithPolicy(pool, recentSlots, abstractPolicy);
  const chosen = new Set(selected);
  for (const paper of classicPool) {
    if (selected.length >= effectiveMax) break;
    if (chosen.has(paper)) continue;
    selected.push(paper);
    chosen.add(paper);
  }
  if (selected.length < effectiveMax) {
    for (const paper of pool) {
      if (selected.length >= effectiveMax) break;
      if (chosen.has(paper)) continue;
      selected.push(paper);
      chosen.add(paper);
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

export function rankRelated(rawPapers, {
  plan = null,
  yearFrom = 0,
  yearTo = new Date().getFullYear(),
  max = 6,
  exclude = []
} = {}) {
  const excluded = new Set(exclude.map(value => String(value || '').toLowerCase()));
  const terms = contextTerms(plan);
  const anchors = topicAnchors(plan);
  const requiredAnchors = Math.min(2, anchors.length);
  const merged = mergePapers(rawPapers).filter(paper => {
    if (!paper.year || paper.year < yearFrom || paper.year > yearTo) return false;
    if (/^(session details|front matter|editorial|correction|erratum|table of contents)/i.test(paper.title || '')) return false;
    if (paper.doi && excluded.has(String(paper.doi).toLowerCase())) return false;
    if (excluded.has(normalizeTitle(paper.title))) return false;
    if (anchors.length && anchorHits(paper, anchors) < requiredAnchors) return false;
    return true;
  });

  const selected = merged
    .map(paper => ({ ...paper, _score: scorePaper(paper, terms) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, max);
  const maxScore = Math.max(...selected.map(paper => paper._score), 1);

  return selected.map((paper, index) => ({
    id: `R${index + 1}`,
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
