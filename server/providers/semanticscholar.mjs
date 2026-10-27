import { fetchJson, stripTags } from '../lib/http.mjs';

const list = value => (value == null ? [] : Array.isArray(value) ? value : [value]);
const text = value => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') return text(value.$ ?? value.name ?? '');
  return '';
};

export async function searchSemanticScholar(query, limit = 30) {
  const params = new URLSearchParams({
    query,
    fields: 'title,abstract,year,venue,authors,citationCount,externalIds,url,publicationTypes',
    minCitationCount: '3'
  });
  const data = await fetchJson(`https://api.semanticscholar.org/graph/v1/paper/search/bulk?${params}`, {
    timeout: 24000,
    retries: 1
  });

  return list(data?.data)
    .slice(0, limit)
    .map(item => {
      const title = stripTags(text(item?.title));
      if (!title) return null;
      const doi = text(item?.externalIds?.DOI).toLowerCase() || null;
      const authors = list(item?.authors).map(author => text(author?.name)).filter(Boolean).slice(0, 8);
      return {
        title,
        authors,
        year: Number(item?.year) || null,
        venue: stripTags(text(item?.venue)),
        doi,
        url: doi ? `https://doi.org/${doi}` : text(item?.url) || (item?.paperId ? `https://www.semanticscholar.org/paper/${item.paperId}` : ''),
        abstract: stripTags(text(item?.abstract)),
        citations: Number(item?.citationCount || 0),
        source: 'Semantic Scholar',
        type: list(item?.publicationTypes).join(', ').toLowerCase() || 'article',
        openAccess: false
      };
    })
    .filter(Boolean);
}
