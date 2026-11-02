import { createHash } from 'node:crypto';
import { createDeepSeek } from './deepseek.mjs';

const cache = new Map();
const MAX_CACHE = 80;

function cacheKey(text) {
  return createHash('sha1').update(text).digest('hex');
}

function looksChinese(text) {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjk >= Math.max(8, text.length * 0.2);
}

export async function translateAbstract(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('摘要为空。');
  if (clean.length > 7000) throw new Error('摘要过长，暂时无法翻译。');
  if (looksChinese(clean)) return clean;

  const key = cacheKey(clean);
  if (cache.has(key)) return cache.get(key);

  const llm = createDeepSeek();
  if (!llm.available) throw new Error('未配置 DeepSeek Key，无法翻译摘要。');

  const data = await llm.json({
    system: `你是学术文献摘要翻译器。把用户提供的英文论文摘要翻译成准确、简洁、自然的简体中文。
要求：
- 保留模型名、数据集名、指标、数字、缩写和专有名词，不要擅自改写；
- grounding 按语境译为“证据对齐”或“视觉定位”，不要译成“接地”；
- 不添加原文没有的事实、数字或结论；
- 不要输出解释或 Markdown，只返回一个 JSON 对象：{"translation":"中文译文"}`,
    user: `请翻译下面这段论文摘要：\n\n${clean}`,
    maxTokens: 2600,
    temperature: 0.12,
    label: 'translator'
  });

  const translation = String(data?.translation || '').trim();
  if (!translation) throw new Error('模型没有返回译文。');

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, translation);
  return translation;
}
