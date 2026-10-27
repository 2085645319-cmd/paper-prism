import { useEffect, useRef } from 'react';
import type { Stage } from '../types';

interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
}

const NODES: NodeDef[] = [
  { id: 'planner', label: '规划', x: 120, y: 20, width: 36 },
  { id: 'semanticscholar', label: 'S2', x: 38, y: 58, width: 28 },
  { id: 'doaj', label: 'DOAJ', x: 120, y: 58, width: 32 },
  { id: 'crossref', label: 'CR', x: 202, y: 58, width: 28 },
  { id: 'analyst', label: '精读', x: 120, y: 94, width: 34 },
  { id: 'synthesizer', label: '综合', x: 120, y: 128, width: 32 },
  { id: 'critic', label: '核查', x: 120, y: 158, width: 38 }
];

const EDGES: Array<[string, string]> = [
  ['planner', 'semanticscholar'],
  ['planner', 'doaj'],
  ['planner', 'crossref'],
  ['semanticscholar', 'analyst'],
  ['doaj', 'analyst'],
  ['crossref', 'analyst'],
  ['analyst', 'synthesizer'],
  ['synthesizer', 'critic']
];

const STATUS_COLORS: Record<string, string> = {
  queued: '#62666d',
  running: '#828fff',
  done: '#27a644',
  error: '#e5484d',
  skipped: '#d6a94a'
};

export function AgentMeshCanvas({ stages }: { stages: Stage[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 240;
    const H = 178;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = 'auto';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const status = new Map(stages.map(stage => [stage.id, stage.status]));
    const byId = new Map(NODES.map(node => [node.id, node]));
    let raf = 0;
    let frame = 0;

    const edgeActive = (from: string, to: string) => {
      const a = status.get(from);
      const b = status.get(to);
      return [a, b].some(value => value === 'running') || (a === 'done' && b === 'done');
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Dot matrix background.
      ctx.fillStyle = 'rgba(247, 248, 248, 0.05)';
      for (let x = 8; x < W; x += 12) {
        for (let y = 8; y < H; y += 12) {
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // Edges.
      for (const [fromId, toId] of EDGES) {
        const from = byId.get(fromId);
        const to = byId.get(toId);
        if (!from || !to) continue;
        const x1 = from.x;
        const y1 = from.y + 9;
        const x2 = to.x;
        const y2 = to.y - 9;
        const midY = (y1 + y2) / 2;
        const active = edgeActive(fromId, toId);
        ctx.strokeStyle = active ? 'rgba(94, 106, 210, 0.38)' : 'rgba(247, 248, 248, 0.1)';
        ctx.lineWidth = active ? 1 : 0.7;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1, midY, x2, midY, x2, y2);
        ctx.stroke();

        if (active && !reduced) {
          const t = (frame * 0.009 + (from.x + to.x) * 0.004) % 1;
          const mt = 1 - t;
          const px = mt * mt * mt * x1 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x2;
          const py = mt * mt * mt * y1 + 3 * mt * mt * t * midY + 3 * mt * t * t * midY + t * t * t * y2;
          ctx.fillStyle = 'rgba(130, 143, 255, 0.85)';
          ctx.beginPath();
          ctx.arc(px, py, 1.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Nodes.
      for (const node of NODES) {
        const state = status.get(node.id) || 'queued';
        const isRunning = state === 'running';
        const pulse = reduced ? 0 : Math.sin(frame * 0.08) * 0.5 + 0.5;
        const w = node.width;
        const h = 18;
        const x = node.x - w / 2;
        const y = node.y - h / 2;

        if (isRunning) {
          ctx.fillStyle = `rgba(94, 106, 210, ${0.06 + pulse * 0.05})`;
          ctx.beginPath();
          ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 5);
          ctx.fill();
        }

        ctx.fillStyle = state === 'running' ? 'rgba(94, 106, 210, 0.22)' : '#0f1011';
        ctx.strokeStyle = state === 'running'
          ? 'rgba(130, 143, 255, 0.9)'
          : state === 'done'
            ? 'rgba(39, 166, 68, 0.45)'
            : state === 'error'
              ? 'rgba(229, 72, 77, 0.7)'
              : 'rgba(247, 248, 248, 0.2)';
        ctx.lineWidth = state === 'running' ? 1.2 : 0.9;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = state === 'queued' ? '#8a8f98' : '#f7f8f8';
        ctx.font = '500 7px "JetBrains Mono", "Microsoft YaHei", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + 0.5);

        ctx.fillStyle = STATUS_COLORS[state] || STATUS_COLORS.queued;
        ctx.beginPath();
        ctx.arc(x + w - 3, y + 3, isRunning ? 1.7 + pulse * 0.5 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(247, 248, 248, 0.28)';
      ctx.font = '6px "JetBrains Mono", "Microsoft YaHei", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('实时拓扑', 8, H - 6);
      ctx.textAlign = 'right';
      ctx.fillText(`${stages.filter(stage => stage.status === 'done').length}/7 完成`, W - 8, H - 6);

      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [stages]);

  return <canvas ref={ref} className="mesh-canvas" aria-hidden="true" />;
}
