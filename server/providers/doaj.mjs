import { fetchJson, stripTags } from '../lib/http.mjs';

const list = value => (value == null ? [] : Array.isArray(value) ? value : [value]);
const text = value => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') return text(value.$ ?? '');
  return '';
};

export async function searchDoaj(query, limit = 10) {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=${limit}`;
  const data = await fetchJson(url, { timeout: 18000, retries: 1 });
  const results = list(data?.results);
  return results
    .map(item => {
      const bib = item?.bibjson;
      if (!bib) return null;
      const title = stripTags(text(bib.title));
      if (!title) return null;
      const identifiers = list(bib.identifier);
      const doi = text(identifiers.find(id => id?.type === 'doi')?.id) || '';
      const links = list(bib.link);
      const fulltext = links.find(link => link?.type === 'fulltext')?.url || links[0]?.url || '';
      const authors = list(bib.author).map(author => text(author?.name)).filter(Boolean).slice(0, 8);
      const year = Number(text(bib.year).slice(0, 4)) || null;
      return {
        title,
        authors,
        year,
        venue: stripTags(text(bib.journal?.title)),
        doi: doi || null,
        url: fulltext || (doi ? `https://doi.org/${doi}` : ''),
        abstract: stripTags(text(bib.abstract)),
        citations: 0,
        source: 'DOAJ',
        type: 'article',
        openAccess: true
      };
    })
    .filter(Boolean);
}
