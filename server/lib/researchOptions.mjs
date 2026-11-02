export const SOURCE_IDS = ['semanticscholar', 'doaj', 'crossref'];
export const YEAR_PRESETS = ['recent3', 'recent5', 'recent10', 'all'];
export const PAPER_COUNTS = [12, 18, 24, 30];

export const DEFAULT_RESEARCH_OPTIONS = {
  yearPreset: 'recent5',
  maxPapers: 18,
  requireAbstract: true,
  includeClassics: false,
  sources: [...SOURCE_IDS]
};

export function yearRangeForPreset(preset, currentYear = new Date().getFullYear()) {
  if (preset === 'recent3') return { yearFrom: currentYear - 2, yearTo: currentYear };
  if (preset === 'recent10') return { yearFrom: currentYear - 9, yearTo: currentYear };
  if (preset === 'all') return { yearFrom: 1900, yearTo: currentYear };
  return { yearFrom: currentYear - 4, yearTo: currentYear };
}

export function normalizeResearchOptions(input = {}) {
  const yearPreset = YEAR_PRESETS.includes(input?.yearPreset) ? input.yearPreset : DEFAULT_RESEARCH_OPTIONS.yearPreset;
  const maxPapers = Math.min(40, Math.max(6, Number(input?.maxPapers) || DEFAULT_RESEARCH_OPTIONS.maxPapers));
  const requestedSources = Array.isArray(input?.sources)
    ? input.sources.filter(source => SOURCE_IDS.includes(source))
    : [];
  const sources = requestedSources.length ? [...new Set(requestedSources)] : [...SOURCE_IDS];
  const { yearFrom, yearTo } = yearRangeForPreset(yearPreset);
  return {
    yearPreset,
    yearFrom,
    yearTo,
    maxPapers,
    requireAbstract: input?.requireAbstract !== false,
    includeClassics: yearPreset === 'all' ? false : Boolean(input?.includeClassics),
    sources
  };
}
