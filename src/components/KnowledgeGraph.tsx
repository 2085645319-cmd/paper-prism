import { useEffect, useRef, useState } from 'react';
import type { Paper, Theme } from '../types';
import { Icon } from './Icon';

interface GraphProps {
  papers: Paper[];
  themes: Theme[];
  onSelectPaper: (paper: Paper) => void;
}

interface GraphNode {
  id: string;
  kind: 'topic' | 'theme' | 'paper';
  label: string;
  sub?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  paper?: Paper;
  theme?: Theme;
}

interface GraphLink {
  source: string;
  target: string;
}

interface HoverState {
  id: string;
  title: string;
  meta: string;
  x: number;
  y: number;
}

function buildGraph(papers: Paper[], themes: Theme[]) {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const center: GraphNode = {
    id: 'TOPIC',
    kind: 'topic',
    label: '课题',
    sub: '研究课题',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 20
  };
  nodes.push(center);

  const safeThemes = themes.length
    ? themes.slice(0, 5)
    : papers.length
      ? [{ name: '语料总览', summary: '', paperIds: papers.map(p => p.id) }]
      : [];

  safeThemes.forEach((theme, index) => {
    const angle = (index / safeThemes.length) * Math.PI * 2 - Math.PI / 2;
    const id = `T${index + 1}`;
    nodes.push({
      id,
      kind: 'theme',
      label: theme.name.length > 22 ? `${theme.name.slice(0, 20)}…` : theme.name,
      sub: `${theme.paperIds.length} 篇文献`,
      x: Math.cos(angle) * 130,
      y: Math.sin(angle) * 130,
      vx: 0,
      vy: 0,
      r: 13,
      theme
    });
    links.push({ source: 'TOPIC', target: id });
    theme.paperIds.forEach(paperId => {
      links.push({ source: id, target: paperId });
    });
  });

  papers.forEach((paper, index) => {
    const angle = (index / Math.max(1, papers.length)) * Math.PI * 2 + 0.35;
    const radius = 230 + (index % 3) * 34;
    nodes.push({
      id: paper.id,
      kind: 'paper',
      label: paper.id,
      sub: paper.title,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      r: 4.5 + Math.min(7, Math.log1p(paper.citations) * 1.15),
      paper
    });
  });

  // A compact force simulation, run before the first paint.
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (let tick = 0; tick < 280; tick++) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          dist = 0.1;
        }
        const min = a.kind === 'topic' || b.kind === 'topic' ? 100 : a.kind === 'theme' && b.kind === 'theme' ? 100 : 52;
        const force = (2400 / (dist * dist)) + (dist < min ? (min - dist) * 0.06 : 0);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
    for (const link of links) {
      const a = byId.get(link.source);
      const b = byId.get(link.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(0.1, Math.hypot(dx, dy));
      const desired = a.kind === 'topic' ? 150 : 112;
      const force = (dist - desired) * 0.012;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    for (const node of nodes) {
      node.vx -= node.x * 0.0025;
      node.vy -= node.y * 0.0025;
      node.vx *= 0.86;
      node.vy *= 0.86;
      node.x += node.vx;
      node.y += node.vy;
      const max = 420;
      node.x = Math.max(-max, Math.min(max, node.x));
      node.y = Math.max(-max, Math.min(max, node.y));
    }
  }

  return { nodes, links };
}

export function KnowledgeGraph({ papers, themes, onSelectPaper }: GraphProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const graphRef = useRef(buildGraph(papers, themes));
  const viewRef = useRef({ panX: 0, panY: 0, zoom: 1 });
  const hoverRef = useRef<string | null>(null);
  const focusRef = useRef<string | null>(null);
  const dragRef = useRef<{ nodeId: string | null; startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    graphRef.current = buildGraph(papers, themes);
    viewRef.current = { panX: 0, panY: 0, zoom: 1 };
    setFocus(null);
    focusRef.current = null;
  }, [papers, themes]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let frame = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(320, rect.width);
      height = Math.max(360, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const worldFromScreen = (sx: number, sy: number) => {
      const { panX, panY, zoom } = viewRef.current;
      return { x: (sx - width / 2 - panX) / zoom, y: (sy - height / 2 - panY) / zoom };
    };

    const screenFromWorld = (x: number, y: number) => {
      const { panX, panY, zoom } = viewRef.current;
      return { x: width / 2 + panX + x * zoom, y: height / 2 + panY + y * zoom };
    };

    const findNode = (sx: number, sy: number) => {
      const { zoom } = viewRef.current;
      const point = worldFromScreen(sx, sy);
      let best: GraphNode | null = null;
      let bestDist = Infinity;
      for (const node of graphRef.current.nodes) {
        const dist = Math.hypot(node.x - point.x, node.y - point.y);
        if (dist < Math.max(14, node.r + 8) / Math.sqrt(zoom) && dist < bestDist) {
          best = node;
          bestDist = dist;
        }
      }
      return best;
    };

    const draw = () => {
      const { nodes, links } = graphRef.current;
      const { panX, panY, zoom } = viewRef.current;
      const hovered = hoverRef.current;
      const focused = focusRef.current;
      const focusNode = focused ? nodes.find(n => n.id === focused) : null;
      const focusLinks = new Set<string>();
      if (focusNode) {
        for (const link of links) {
          if (link.source === focusNode.id || link.target === focusNode.id) {
            focusLinks.add(link.source);
            focusLinks.add(link.target);
          }
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Instrument grid.
      ctx.strokeStyle = 'rgba(247,248,248,0.035)';
      ctx.lineWidth = 0.6;
      const grid = 96 * zoom;
      const ox = ((width / 2 + panX) % grid + grid) % grid;
      const oy = ((height / 2 + panY) % grid + grid) % grid;
      for (let x = ox; x < width; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = oy; y < height; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(width / 2 + panX, height / 2 + panY);
      ctx.scale(zoom, zoom);

      for (const [linkIndex, link] of links.entries()) {
        const a = nodes.find(n => n.id === link.source);
        const b = nodes.find(n => n.id === link.target);
        if (!a || !b) continue;
        const highlighted = (hovered && (link.source === hovered || link.target === hovered)) || (focusNode && focusLinks.has(link.source) && focusLinks.has(link.target));
        ctx.strokeStyle = highlighted ? 'rgba(94,106,210,0.58)' : 'rgba(247,248,248,0.09)';
        ctx.lineWidth = highlighted ? 1.15 : 0.65;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        if (!reduced) {
          const t = (frame * 0.0045 + linkIndex * 0.137) % 1;
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          ctx.fillStyle = highlighted ? 'rgba(130,143,255,0.9)' : 'rgba(94,106,210,0.34)';
          ctx.beginPath();
          ctx.arc(px, py, highlighted ? 1.45 : 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const labelRects: Array<{ x: number; y: number; w: number; h: number }> = [];
      for (const node of nodes) {
        const isHover = hovered === node.id;
        const isFocus = focused === node.id;
        const inFocus = !focusNode || focusLinks.has(node.id) || isFocus;
        const alpha = inFocus ? 1 : 0.28;

        if (node.kind === 'topic') {          ctx.globalAlpha = alpha;
          ctx.fillStyle = 'rgba(94,106,210,0.12)';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(94,106,210,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#010102';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#5e6ad2';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#d0d6e0';
          ctx.font = '500 9px "JetBrains Mono", "Microsoft YaHei", Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('课题', node.x, node.y + 34);
          ctx.globalAlpha = 1;
          continue;
        }

        if (node.kind === 'theme') {
          const pulse = reduced ? 0 : (Math.sin(frame * 0.035 + node.x) * 0.5 + 0.5) * 0.25;
          ctx.globalAlpha = alpha;
          ctx.save();
          ctx.translate(node.x, node.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = isHover || isFocus ? 'rgba(94,106,210,0.2)' : '#141516';
          ctx.strokeStyle = isHover || isFocus ? 'rgba(94,106,210,0.9)' : 'rgba(247,248,248,0.38)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-9, -9, 18, 18, 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          if (isHover || isFocus) {
            ctx.strokeStyle = `rgba(94,106,210,${0.35 + pulse})`;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
            ctx.stroke();
          }

          const label = node.label.length > 26 ? `${node.label.slice(0, 24)}…` : node.label;
          ctx.font = '500 10px Inter, "Microsoft YaHei", "Segoe UI", sans-serif';
          const angle = Math.atan2(node.y, node.x);
          const screen = screenFromWorld(node.x, node.y);
          const nearRight = screen.x > width - 130;
          const nearLeft = screen.x < 110;
          const dirX = nearRight ? -1 : nearLeft ? 1 : Math.cos(angle);
          const dirY = Math.sin(angle);
          const labelX = node.x + dirX * 28;
          let labelY = node.y + dirY * 28 + 3;
          const align = nearRight ? 'right' : nearLeft ? 'left' : Math.abs(dirX) < 0.25 ? 'center' : dirX > 0 ? 'left' : 'right';
          const labelWidth = ctx.measureText(label).width;
          const bgX = align === 'left'
            ? labelX - 3
            : align === 'right'
              ? labelX - labelWidth - 3
              : labelX - labelWidth / 2 - 3;

          const collides = () => labelRects.some(rect => !(
            bgX + labelWidth + 7 < rect.x ||
            bgX > rect.x + rect.w ||
            labelY - 9 + 13 < rect.y ||
            labelY - 9 > rect.y + rect.h
          ));
          for (let guard = 0; guard < 5 && collides(); guard++) {
            labelY += dirY >= 0 ? 14 : -14;
          }
          if (Math.abs(labelY - (node.y + dirY * 28 + 3)) > 2) {
            ctx.strokeStyle = 'rgba(247, 248, 248, 0.16)';
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(labelX, labelY);
            ctx.stroke();
          }
          labelRects.push({ x: bgX, y: labelY - 9, w: labelWidth + 7, h: 13 });

          ctx.fillStyle = 'rgba(15, 16, 17, 0.92)';
          ctx.fillRect(bgX, labelY - 9, labelWidth + 7, 13);
          ctx.textAlign = align;
          ctx.fillStyle = isHover || isFocus ? '#f7f8f8' : '#d0d6e0';
          ctx.fillText(label, labelX, labelY);
          ctx.globalAlpha = 1;
          continue;
        }

        // Paper node.
        ctx.globalAlpha = alpha;
        const cited = focusNode && focusLinks.has(node.id) && node.kind === 'paper';
        ctx.fillStyle = isHover || isFocus ? '#5e6ad2' : cited ? 'rgba(94,106,210,0.75)' : '#18191a';
        ctx.strokeStyle = isHover || isFocus ? '#f7f8f8' : 'rgba(247,248,248,0.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isHover || isFocus || zoom > 1.35) {
          ctx.fillStyle = isHover || isFocus ? '#f7f8f8' : '#8a8f98';
          ctx.font = '9px "JetBrains Mono", "Microsoft YaHei", Consolas, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(node.id, node.x + node.r + 5, node.y + 3);
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const drag = dragRef.current;
      if (drag) {
        drag.moved = drag.moved || Math.hypot(sx - drag.startX, sy - drag.startY) > 3;
        if (drag.nodeId) {
          const node = graphRef.current.nodes.find(n => n.id === drag.nodeId);
          if (node) {
            const point = worldFromScreen(sx, sy);
            node.x = point.x;
            node.y = point.y;
            node.vx = 0;
            node.vy = 0;
          }
        } else {
          viewRef.current.panX = drag.panX + sx - drag.startX;
          viewRef.current.panY = drag.panY + sy - drag.startY;
        }
        return;
      }

      const node = findNode(sx, sy);
      const next = node?.id || null;
      if (next !== hoverRef.current) {
        hoverRef.current = next;
        if (node) {
          setHover({
            id: node.id,
            title: node.kind === 'paper' ? node.paper?.title || node.id : node.label,
            meta: node.kind === 'paper'
              ? `${node.paper?.year || '—'} · ${node.paper?.venue || '文献'} · ${node.paper?.citations || 0} 次引用`
              : node.kind === 'theme'
                ? node.sub || '主题'
                : '研究课题',
            x: sx,
            y: sy
          });
        } else {
          setHover(null);
        }
      } else if (hover) {
        setHover(h => (h ? { ...h, x: sx, y: sy } : h));
      }
      canvas.style.cursor = node ? 'pointer' : 'grab';
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const node = findNode(sx, sy);
      if (!node) {
        viewRef.current.panX = viewRef.current.panX;
      }
      dragRef.current = {
        nodeId: node?.id || null,
        startX: sx,
        startY: sy,
        panX: viewRef.current.panX,
        panY: viewRef.current.panY,
        moved: false
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = wrap.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      if (!drag.moved) {
        const node = findNode(sx, sy);
        if (node?.kind === 'paper' && node.paper) onSelectPaper(node.paper);
        if (node?.kind === 'theme') {
          const id = node.id;
          setFocus(current => (current === id ? null : id));
          focusRef.current = focusRef.current === id ? null : id;
        }
      }
      dragRef.current = null;
      canvas.style.cursor = 'grab';
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const view = viewRef.current;
      const before = worldFromScreen(sx, sy);
      const factor = Math.exp(-event.deltaY * 0.0012);
      view.zoom = Math.max(0.55, Math.min(2.4, view.zoom * factor));
      const after = worldFromScreen(sx, sy);
      view.panX += (after.x - before.x) * view.zoom;
      view.panY += (after.y - before.y) * view.zoom;
    };

    resize();
    draw();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('pointerdown', onPointerDown);
    wrap.addEventListener('pointerup', onPointerUp);
    wrap.addEventListener('pointercancel', onPointerUp);
    wrap.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('pointerdown', onPointerDown);
      wrap.removeEventListener('pointerup', onPointerUp);
      wrap.removeEventListener('pointercancel', onPointerUp);
      wrap.removeEventListener('wheel', onWheel);
    };
  }, [onSelectPaper]);

  const zoomBy = (factor: number) => {
    viewRef.current.zoom = Math.max(0.55, Math.min(2.4, viewRef.current.zoom * factor));
  };
  const reset = () => {
    viewRef.current = { panX: 0, panY: 0, zoom: 1 };
    setFocus(null);
    focusRef.current = null;
  };

  const activeTheme = focus ? graphRef.current.nodes.find(n => n.id === focus)?.theme : null;

  return (
    <div className="graph-shell" ref={wrapRef}>
      <div className="graph-legend">
        <span><i className="legend-dot topic" />课题</span>
        <span><i className="legend-dot theme" />主题</span>
        <span><i className="legend-dot paper" />文献</span>
      </div>
      <div className="graph-controls">
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="放大"><Icon name="plus" size={14} /></button>
        <button type="button" onClick={() => zoomBy(0.8)} aria-label="缩小"><span className="minus" /></button>
        <button type="button" onClick={reset} aria-label="重置视图"><Icon name="refresh" size={14} /></button>
      </div>
      <div className="graph-meta">
        <span>{papers.length} 篇文献</span>
        <span>{themes.length || (papers.length ? 1 : 0)} 个主题</span>
        <span>{themes.reduce((sum, theme) => sum + theme.paperIds.length, 0) + (themes.length || (papers.length ? 1 : 0))} 条边</span>
        <span className="graph-meta-dim">节点大小 = 引用数</span>
      </div>
      <canvas ref={canvasRef} className="graph-canvas" />
      {hover && (
        <div className="graph-tooltip" style={{ left: hover.x + 16, top: hover.y + 14 }}>
          <strong>{hover.title}</strong>
          <span>{hover.meta}</span>
        </div>
      )}
      {activeTheme && (
        <div className="graph-focus">
          <span className="mono-label">聚焦 / 主题</span>
          <strong>{activeTheme.name}</strong>
          <p>{activeTheme.summary}</p>
        </div>
      )}
      <div className="graph-hint">拖拽移动 · 滚轮缩放 · 点击文献</div>
      {!papers.length && <div className="graph-empty">等待文献数据…</div>}
    </div>
  );
}
