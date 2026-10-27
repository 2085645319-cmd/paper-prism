import type { PrismEvent, ResearchResult } from './types';

export async function getHealth(): Promise<{ ok: boolean; llm: boolean; model: string; sources: string[] }> {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error('服务健康检查失败');
  return response.json();
}

export async function startResearch(topic: string): Promise<{ id: string }> {
  const response = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic })
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
