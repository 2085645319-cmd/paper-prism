import type { ChatReply, PrismEvent, ResearchOptions, ResearchResult } from './types';

export async function getHealth(): Promise<{ ok: boolean; llm: boolean; model: string; sources: string[] }> {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error('服务健康检查失败');
  return response.json();
}

export async function startResearch(topic: string, options?: ResearchOptions): Promise<{ id: string }> {
  const response = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, options })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '无法启动研究任务。');
  return data;
}

export function subscribeToResearch(
  id: string,
  onEvent: (event: PrismEvent) => void,
  onConnectionError: () => void
): () => void {
  const source = new EventSource(`/api/research/${id}/events`);
  source.onmessage = message => {
    try {
      onEvent(JSON.parse(message.data) as PrismEvent);
    } catch {
      // Ignore malformed frames.
    }
  };
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) onConnectionError();
  };
  return () => source.close();
}

export async function getSnapshot(id: string): Promise<{ status: string; events: PrismEvent[]; result: ResearchResult | null; error: string | null }> {
  const response = await fetch(`/api/research/${id}`);
  if (!response.ok) throw new Error('无法加载研究任务。');
  return response.json();
}

export async function translateAbstract(text: string): Promise<string> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '摘要翻译失败。');
  return String(data.translation || '');
}

export async function chatWithResearch(
  id: string,
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ChatReply> {
  const response = await fetch(`/api/research/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '对话暂时不可用。');
  return data as ChatReply;
}
