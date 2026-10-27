import { randomUUID } from 'node:crypto';

const jobs = new Map();

export class ResearchJob {
  constructor(topic) {
    this.id = randomUUID().slice(0, 8);
    this.topic = topic;
    this.status = 'running';
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.events = [];
    this.subscribers = new Set();
    this.result = null;
    this.error = null;
  }

  emit(type, payload = {}) {
    const event = { type, at: Date.now(), ...payload };
    if (type === 'warning' || type === 'error') {
      console.warn(`[prism] ${type}: ${payload.message || ''}${payload.detail ? ` — ${payload.detail}` : ''}`);
    }
    this.events.push(event);
    if (this.events.length > 320) this.events.shift();
    this.updatedAt = Date.now();
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch {
        // A dropped SSE client must not break the run.
      }
    }
    return event;
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  complete(result) {
    this.status = 'complete';
    this.result = result;
    this.updatedAt = Date.now();
    this.emit('done', { result });
  }

  fail(error) {
    this.status = 'error';
    this.error = error?.message || String(error);
    this.updatedAt = Date.now();
    this.emit('error', { message: this.error });
  }

  snapshot() {
    return {
      id: this.id,
      topic: this.topic,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      events: this.events,
      result: this.result,
      error: this.error
    };
  }
}

export function createJob(topic) {
  const job = new ResearchJob(topic);
  jobs.set(job.id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

// Keep the demo process bounded.
const sweeper = setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 60;
  for (const [id, job] of jobs) {
    if (job.updatedAt < cutoff) jobs.delete(id);
  }
}, 1000 * 60 * 10);
sweeper.unref?.();
