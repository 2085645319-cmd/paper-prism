import { CONFIG, hasLLM } from '../config.mjs';
import { sleep } from './http.mjs';

export class LLMError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
  }
}

function extractJson(text) {
  if (!text || typeof text !== 'string') throw new LLMError('Empty model response');
  let clean = text.trim();
  const fence = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) clean = fence[1].trim();
  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new LLMError('Model response is not JSON');
  const candidate = clean.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    throw new LLMError(`Model returned invalid JSON: ${error.message}`);
  }
}

export function createDeepSeek({ onUsage } = {}) {
  if (!hasLLM()) {
    return {
      available: false,
      async json() {
        throw new LLMError('DEEPSEEK_API_KEY is not configured');
      }
    };
  }

  return {
    available: true,
    async json({ system, user, maxTokens = 2600, temperature = 0.25, label = 'agent' }) {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`${CONFIG.deepseekBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${CONFIG.deepseekKey}`
            },
            body: JSON.stringify({
              model: CONFIG.deepseekModel,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user }
              ],
              temperature,
              max_tokens: maxTokens,
              response_format: { type: 'json_object' },
              stream: false
            }),
            signal: AbortSignal.timeout(120000)
          });

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            const error = new LLMError(`${label} failed (${response.status}): ${text.slice(0, 220)}`, response.status);
            if ((response.status === 429 || response.status >= 500) && attempt < 2) {
              lastError = error;
              const retryAfter = Number(response.headers.get('retry-after') || 0) * 1000;
              await sleep(Math.min(10000, retryAfter || 1800 * (attempt + 1) ** 2));
              continue;
            }
            throw error;
          }

          const data = await response.json();
          const choice = data?.choices?.[0];
          if (choice?.finish_reason === 'length') {
            const error = new LLMError(`${label} response was truncated`);
            error.code = 'truncated';
            throw error;
          }
          if (onUsage && data?.usage) {
            onUsage({
              label,
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0
            });
          }
          return extractJson(choice?.message?.content || '');
        } catch (error) {
          lastError = error;
          if (attempt < 2 && error.name === 'TimeoutError') {
            await sleep(1000 * (attempt + 1));
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    }
  };
}
