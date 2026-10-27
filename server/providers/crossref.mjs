import { CONFIG } from '../config.mjs';
import { fetchJson, stripTags } from '../lib/http.mjs';

const list = value => (value == null ? [] : Array.isArray(value) ? value : [value]);
const text = value => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') return text(value.$ ?? '');
  return '';
};

function yearOf(item) {
  for (const key of ['issued', 'published-print', 'published-online', 'created']) {
    const parts = item?.[key]?.['date-parts']?.[0];
    if (parts?.[0]) return Number(parts[0]);
  }
  return null;
}

export async function searchCrossref(query, limit = 10) {
  const params = new URLSearchParams({
    'query.bibliographic': query,
    rows: String(limit),
    select: 'DOI,title,author,issued,container-title,abstract,is-referenced-by-count,URL,type,publisher',
    mailto: CONFIG.contactEmail
  });
  const data = await fetchJson(`https://api.crossref.org/works?${params}`, {
    timeout: 16000,
    retries: 1
  });
  return list(data?.message?.items)
    .map(item => {
      const title = stripTags(text(item?.title));
      if (!title) return null;
      const authors = list(item?.author)
        .map(author => [author?.given, author?.family].filter(Boolean).join(' ') || text(author?.name))
        .filter(Boolean)
        .slice(0, 8);
      const doi = text(item?.DOI).toLowerCase() || '';
      return {
        title,
        authors,
        year: yearOf(item),
        venue: stripTags(text(item?.['container-title']) || text(item?.publisher)),
        doi: doi || null,
        url: doi ? `https://doi.org/${doi}` : text(item?.URL),
        abstract: stripTags(text(item?.abstract)),
        citations: Number(item?.['is-referenced-by-count'] || 0),
        source: 'Crossref',
        type: text(item?.type) || 'article',
        openAccess: false
      };
    })
    .filter(Boolean);
}
