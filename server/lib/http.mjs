import { CONFIG } from '../config.mjs';

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function fetchWithRetry(url, options = {}) {
  const {
    timeout = CONFIG.requestTimeoutMs,
    retries = 1,
    headers = {},
    method = 'GET',
    body
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        body,
        headers: {
          'User-Agent': `PRISM/0.1 (mailto:${CONFIG.contactEmail})`,
          Accept: 'application/json, text/plain, */*',
          ...headers
        },
        signal: AbortSignal.timeout(timeout)
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const error = new HttpError(`${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 180)}` : ''}`, response.status);
        if (RETRYABLE.has(response.status) && attempt < retries) {
          lastError = error;
          await sleep(450 * (attempt + 1) + Math.random() * 250);
          continue;
        }
        throw error;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries && error.name !== 'AbortError') {
        await sleep(450 * (attempt + 1) + Math.random() * 250);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function fetchJson(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  return response.json();
}

export async function fetchText(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  return response.text();
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function stripTags(input = '') {
  return String(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
