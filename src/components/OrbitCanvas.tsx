import { useEffect, useRef } from 'react';

const NODES = [
  { label: '规划', angle: -1.15 },
  { label: '检索', angle: 0.05 },
  { label: '精读', angle: 1.25 },
  { label: '综合', angle: 2.45 },
  { label: '核查', angle: 3.65 }
];

export function OrbitCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const size = 560;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;
    let raf = 0;
    const pointer = { x: 0, y: 0 };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const draw = () => {
      const cx = size / 2 + pointer.x * 7;
      const cy = size / 2 + pointer.y * 7;
      ctx.clearRect(0, 0, size, size);

      // Outer instrument rings.
      ctx.strokeStyle = 'rgba(247, 248, 248, 0.08)';
      ctx.lineWidth = 1;
      [196, 152, 108].forEach((radius, index) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = index === 0 ? 'rgba(247, 248, 248, 0.1)' : 'rgba(247, 248, 248, 0.05)';
        ctx.stroke();
      });

      // Tick marks.
      for (let i = 0; i < 72; i++) {
        const angle = (i / 72) * Math.PI * 2;
        const major = i % 6 === 0;
        const r1 = 196;
        const r2 = major ? 187 : 192;
        ctx.strokeStyle = major ? 'rgba(247, 248, 248, 0.18)' : 'rgba(247, 248, 248, 0.08)';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
        ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        ctx.stroke();
      }

      // Sweep line.
      const sweep = (frame * 0.006) % (Math.PI * 2);
      if (!reduced) {
        ctx.strokeStyle = 'rgba(94, 106, 210, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweep) * 196, cy + Math.sin(sweep) * 196);
        ctx.stroke();
      }

      // Center core.
      ctx.fillStyle = 'rgba(94, 106, 210, 0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(94, 106, 210, 0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 54, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#f7f8f8';
      ctx.font = '600 13px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('课题', cx, cy - 2);
      ctx.fillStyle = '#8a8f98';
      ctx.font = '10px "JetBrains Mono", "Microsoft YaHei", monospace';
      ctx.fillText('输入 / 01', cx, cy + 15);

      NODES.forEach((node, index) => {
        const angle = node.angle + (reduced ? 0 : frame * 0.0011);
        const radius = 152;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const pulse = reduced ? 0 : Math.sin(frame * 0.025 + index) * 0.5 + 0.5;
        const active = index === 2;

        ctx.strokeStyle = active
          ? `rgba(94, 106, 210, ${0.55 + pulse * 0.25})`
          : `rgba(247, 248, 248, ${0.17 + pulse * 0.05})`;
        ctx.lineWidth = active ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * 58, cy + Math.sin(angle) * 58);
        ctx.lineTo(x, y);
        ctx.stroke();

        if (active) {
          ctx.fillStyle = `rgba(94, 106, 210, ${0.08 + pulse * 0.06})`;
          ctx.beginPath();
          ctx.arc(x, y, 22, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#010102';
        ctx.strokeStyle = active ? '#5e6ad2' : 'rgba(247, 248, 248, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = active ? '#f7f8f8' : '#8a8f98';
        ctx.font = '500 10px "JetBrains Mono", "Microsoft YaHei", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, x, y + (y > cy ? 24 : -16));
      });

      // Corner labels.
      ctx.textAlign = 'left';
      ctx.fillStyle = '#62666d';
      ctx.font = '10px "JetBrains Mono", "Microsoft YaHei", monospace';
      ctx.fillText('智能体网络 / 05', 18, 26);
      ctx.textAlign = 'right';
      ctx.fillText('实时', size - 18, 26);

      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    draw();
    canvas.addEventListener('pointermove', onPointer);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return <canvas ref={ref} className="orbit-canvas" aria-hidden="true" />;
}
