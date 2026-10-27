import { useEffect, useMemo, useRef, useState } from 'react';
import { AmbientCanvas } from './components/AmbientCanvas';
import { OrbitCanvas } from './components/OrbitCanvas';
import { Composer } from './components/Composer';
import { AgentRail } from './components/AgentRail';
import { BriefView } from './components/BriefView';
import { PapersView } from './components/PapersView';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { TraceView } from './components/TraceView';
import { PaperDrawer } from './components/PaperCard';
import { CommandPalette, type PaletteCommand } from './components/CommandPalette';
import { ResearchTelemetry } from './components/ResearchTelemetry';
import { Icon } from './components/Icon';
import { Stat } from './components/Stat';
import { getHealth, startResearch, subscribeToResearch } from './api';
import { confidenceLabel, STATUS_LABEL } from './i18n';
import type {
  Analysis,
  Brief,
  CorpusStats,
  Paper,
  PrismEvent,
  Quality,
  ResearchPlan,
  ResearchResult,
  SourceStat,
  Stage,
  TraceEntry
} from './types';

const EXAMPLES = [
  '多模态大模型的可信推理',
  '科学发现中的 AI 智能体',
  '联邦学习的隐私与效用权衡'
];

const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

const INITIAL_STAGES: Stage[] = [
  { id: 'planner', name: '规划智能体', role: '拆解研究问题', short: 'PLAN', status: 'queued', detail: '拆解研究问题' },
  { id: 'semanticscholar', name: 'Semantic Scholar', role: '引用感知学术图谱', short: 'SCAN', status: 'queued', detail: '引用感知学术图谱' },
  { id: 'doaj', name: 'DOAJ 检索', role: '开放获取期刊', short: 'SCAN', status: 'queued', detail: '开放获取期刊' },
  { id: 'crossref', name: 'Crossref 检索', role: 'DOI 元数据', short: 'SCAN', status: 'queued', detail: 'DOI 元数据' },
  { id: 'analyst', name: '证据分析', role: '抽取论点与局限', short: 'READ', status: 'queued', detail: '抽取论点与局限' },
  { id: 'synthesizer', name: '综合编辑', role: '归纳主题与未解问题', short: 'SYNTH', status: 'queued', detail: '归纳主题与未解问题' },
  { id: 'critic', name: '引用核查', role: '复核证据链', short: 'CHECK', status: 'queued', detail: '复核证据链' }
];

type Tab = 'brief' | 'papers' | 'graph' | 'trace';
type View = 'home' | 'research';

function humanEvent(event: PrismEvent): { type: string; agent?: string; message: string } | null {
  switch (event.type) {
    case 'stage': {
      const status = String(event.status || '');
      const detail = event.detail ? ` — ${event.detail}` : '';
      return { type: 'stage', agent: String(event.id || ''), message: `${STATUS_LABEL[status] || status}${detail}` };
    }
    case 'plan': {
      const plan = event.plan as ResearchPlan;
      return { type: 'plan', agent: 'planner', message: `${plan.queries.length} 条检索式 · ${plan.dimensions.length} 个分析视角 · ${plan.field}` };
    }
    case 'papers': {
      const papers = event.papers as Paper[];
      const sources = event.sources as SourceStat[];
      return { type: 'papers', agent: 'scouts', message: `${papers.length} 篇文献已选 · ${sources.filter(source => source.status === 'done').length}/${sources.length} 个来源返回记录` };
    }
    case 'analysis': {
      const analysis = event.analysis as Analysis;
      return { type: 'analysis', agent: 'analyst', message: `${analysis.themes.length} 个主题 · ${analysis.gaps.length} 个缺口 · ${analysis.mode === 'llm' ? '模型分析' : '启发式'}` };
    }
    case 'brief': {
      const brief = event.brief as Brief;
      return { type: 'brief', agent: 'synthesizer', message: `${brief.painPoints.length} 个未解问题 · ${brief.readingPath.length} 篇文献在阅读路径中` };
    }
    case 'review': {
      const quality = event.quality as Quality;
      return { type: 'review', agent: 'critic', message: `${confidenceLabel(quality.confidence)}置信度 · ${quality.checks.filter(check => check.status === 'pass').length}/${quality.checks.length} 项检查通过` };
    }
    case 'usage':
      return { type: 'usage', agent: String(event.label || 'model'), message: `${event.totalTokens} 词元 · 输入 ${event.promptTokens} / 输出 ${event.completionTokens}` };
    case 'warning':
      return { type: 'warning', agent: 'runtime', message: `${event.message}${event.detail ? ` — ${event.detail}` : ''}` };
    case 'error':
      return { type: 'error', agent: 'runtime', message: String(event.message || '未知错误') };
    case 'done': {
      const result = event.result as ResearchResult;
      return { type: 'done', agent: 'runtime', message: `研究完成，用时 ${(result.meta.durationMs / 1000).toFixed(1)} 秒` };
    }
    default:
      return null;
  }
}

function buildMarkdown(result: ResearchResult) {
  const lines: string[] = [];
  lines.push(`# ${result.brief.title}`, '');
  lines.push(`> ${result.brief.standfirst}`, '');
  lines.push(`**课题：** ${result.topic}`, `**生成时间：** ${new Date(result.meta.generatedAt).toLocaleString('zh-CN')}`, `**置信度：** ${confidenceLabel(result.quality.confidence)}`, '');
  lines.push('## 研究范围', result.brief.scope, '');
  lines.push('## 核心主题', '');
  result.brief.keyThemes.forEach(theme => {
    lines.push(`### ${theme.name}`, theme.insight, `来源： ${theme.paperIds.join(', ')}`, '');
  });
  lines.push('## 共识', ...result.brief.consensus.map(item => `- ${item}`), '');
  lines.push('## 分歧', ...result.brief.tensions.map(item => `- ${item}`), '');
  lines.push('## 未解问题', '');
  result.brief.painPoints.forEach((pain, index) => {
    lines.push(`### ${index + 1}. ${pain.title}`, pain.detail, `证据： ${pain.evidenceIds.join(', ')}`, `研究切口： ${pain.opportunity}`, '');
  });
  lines.push('## 阅读路径', '');
  result.brief.readingPath.forEach((item, index) => {
    const paper = result.papers.find(p => p.id === item.paperId);
    lines.push(`${index + 1}. **${paper?.title || item.paperId}** — ${item.why}`);
  });
  lines.push('', '## 文献', '');
  result.papers.forEach(paper => {
    lines.push(`- **[${paper.id}]** ${paper.title}. ${paper.authors.slice(0, 4).join(', ')}${paper.authors.length > 4 ? ' 等' : ''} (${paper.year || '年份未注'}). ${paper.venue || ''}. ${paper.url || ''}`);
  });
  lines.push('', '## 方法与局限', ...result.brief.methodNotes.map(note => `- ${note}`), ...result.brief.caveats.map(note => `- ${note}`), '');
  return lines.join('\n');
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [topic, setTopic] = useState('');
  const [activeTopic, setActiveTopic] = useState('');
  const [jobId, setJobId] = useState('');
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [sources, setSources] = useState<SourceStat[]>([]);
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('brief');
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const [toast, setToast] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const streamRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef(0);
  const traceIdRef = useRef(0);
  const scrollProgressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getHealth().then(health => setLlmReady(health.llm)).catch(() => setLlmReady(false));
    return () => streamRef.current?.();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(value => !value);
        return;
      }
      if (paletteOpen) return;
      if (event.key === 'Escape') {
        setSelectedPaper(null);
        return;
      }
      if (event.key === '/' && !typing) {
        event.preventDefault();
        document.getElementById('topic-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = scrollProgressRef.current;
      if (!node) return;
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
      node.style.transform = `scaleX(${ratio})`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(onScroll);
    observer.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const append轨迹 = (event: PrismEvent) => {
    const human = humanEvent(event);
    if (!human) return;
    traceIdRef.current += 1;
    setTrace(current => [...current.slice(-160), { id: traceIdRef.current, at: event.at, ...human }]);
  };

  const closeStream = () => {
    streamRef.current?.();
    streamRef.current = null;
  };

  const resetRun = () => {
    closeStream();
    setStages(INITIAL_STAGES);
    setPlan(null);
    setPapers([]);
    setAnalysis(null);
    setBrief(null);
    setQuality(null);
    setSources([]);
    setStats(null);
    setResult(null);
    setTrace([]);
    setError('');
    setSelectedPaper(null);
    setTab('brief');
    setElapsed(0);
  };

  const start = async (value?: string) => {
    const nextTopic = (value ?? topic).trim();
    if (nextTopic.length < 3 || running) return;
    resetRun();
    setActiveTopic(nextTopic);
    setView('research');
    setRunning(true);
    startTimeRef.current = Date.now();
    setElapsed(0);

    try {
      const job = await startResearch(nextTopic);
      setJobId(job.id);
      streamRef.current = subscribeToResearch(
        job.id,
        event => {
          append轨迹(event);
          switch (event.type) {
            case 'stages':
              setStages(event.stages as Stage[]);
              break;
            case 'stage':
              setStages(current => current.map(stage => stage.id === event.id ? { ...stage, status: event.status as Stage['status'], detail: String(event.detail || stage.detail || '') } : stage));
              break;
            case 'plan':
              setPlan(event.plan as ResearchPlan);
              break;
            case 'papers':
              setPapers(event.papers as Paper[]);
              setSources(event.sources as SourceStat[]);
              setStats(event.stats as CorpusStats);
              break;
            case 'analysis':
              setAnalysis(event.analysis as Analysis);
              break;
            case 'brief':
              setBrief(event.brief as Brief);
              break;
            case 'review':
              setQuality(event.quality as Quality);
              break;
            case 'done': {
              const final = event.result as ResearchResult;
              setResult(final);
              setPlan(final.plan);
              setPapers(final.papers);
              setAnalysis(final.analysis);
              setBrief(final.brief);
              setQuality(final.quality);
              setSources(final.sources);
              setStats(final.stats);
              setRunning(false);
              closeStream();
              break;
            }
            case 'error':
              setError(String(event.message || 'Research run failed.'));
              setRunning(false);
              closeStream();
              break;
            default:
              break;
          }
        },
        () => {
          setError('事件流已断开，请重新发起研究。');
        }
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the research run.');
      setRunning(false);
    }
  };

  const goHome = () => {
    closeStream();
    setRunning(false);
    setView('home');
    setJobId('');
    setSelectedPaper(null);
    setTimeout(() => document.getElementById('topic-input')?.focus(), 60);
  };

  const exportBrief = () => {
    if (!result) return;
    const markdown = buildMarkdown(result);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `prism-${result.topic.replace(/[^\w\u4e00-\u9fff]+/g, '-').slice(0, 45)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast('简报已导出为 Markdown');
  };

  const focusTopic = () => {
    setView('home');
    setTimeout(() => document.getElementById('topic-input')?.focus(), 50);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paletteOpen || view !== 'research') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        setTab((['brief', 'papers', 'graph', 'trace'] as const)[Number(event.key) - 1]);
      } else if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        exportBrief();
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        goHome();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, view, result]);

  const copyTopic = async () => {
    try {
      await navigator.clipboard.writeText(activeTopic);
      setToast('研究课题已复制');
    } catch {
      setToast('当前浏览器不允许访问剪贴板');
    }
  };

  const paletteCommands: PaletteCommand[] = view === 'home'
    ? [
        { id: 'focus', group: '开始', label: '聚焦研究课题', hint: '跳到输入框，开始输入课题', shortcut: '/', icon: 'search', run: focusTopic },
        { id: 'method', group: '探索', label: '跳到方法', hint: '查看智能体网络如何工作', icon: 'graph', run: () => document.getElementById('method')?.scrollIntoView({ behavior: 'smooth' }) },
        { id: 'output', group: '探索', label: '跳到产出', hint: '查看简报包含什么', icon: 'book', run: () => document.getElementById('output')?.scrollIntoView({ behavior: 'smooth' }) },
        { id: 'example', group: '开始', label: '试一个示例课题', hint: EXAMPLES[0], icon: 'spark', run: () => { setTopic(EXAMPLES[0]); setTimeout(() => document.getElementById('topic-input')?.focus(), 40); } }
      ]
    : [
        { id: 'brief', group: '导航', label: '打开简报', hint: '主题、共识与未解问题', shortcut: '1', icon: 'book', run: () => setTab('brief') },
        { id: 'papers', group: '导航', label: '打开文献', hint: `${papers.length} 篇排序后的文献`, shortcut: '2', icon: 'list', run: () => setTab('papers') },
        { id: 'graph', group: '导航', label: '打开知识图谱', hint: '探索主题与引用关系', shortcut: '3', icon: 'graph', run: () => setTab('graph') },
        { id: 'trace', group: '导航', label: '打开执行轨迹', hint: '按顺序查看每条智能体消息', shortcut: '4', icon: 'command', run: () => setTab('trace') },
        { id: 'export', group: '操作', label: '导出 Markdown 简报', hint: result ? '下载当前研究结果' : '研究完成后可用', shortcut: 'E', icon: 'download', disabled: !result, run: exportBrief },
        { id: 'copy', group: '操作', label: '复制研究课题', hint: activeTopic, shortcut: 'C', icon: 'copy', run: copyTopic },
        { id: 'first-paper', group: '操作', label: '打开第一篇文献', hint: papers[0]?.title || '暂无文献', icon: 'external', disabled: !papers.length, run: () => papers[0] && setSelectedPaper(papers[0]) },
        { id: 'run-id', group: '操作', label: '复制研究编号', hint: jobId || '暂无研究', icon: 'command', disabled: !jobId, run: async () => { try { await navigator.clipboard.writeText(jobId); setToast(`研究编号 ${jobId} 已复制`); } catch { setToast('当前浏览器不允许访问剪贴板'); } } },
        { id: 'new', group: '操作', label: '新研究', hint: '离开当前研究，重新开始', shortcut: 'N', icon: 'plus', run: goHome }
      ];


  const insight = selectedPaper && analysis ? analysis.papers[selectedPaper.id] : undefined;
  const completedStages = stages.filter(stage => stage.status === 'done').length;
  const progress = Math.round((completedStages / stages.length) * 100);
  const timeLabel = `${String(Math.floor(elapsed / 60000)).padStart(2, '0')}:${String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')}`;

  const statsView = useMemo(() => ({
    papers: stats?.papers ?? papers.length,
    citations: stats?.citations ?? papers.reduce((sum, paper) => sum + paper.citations, 0),
    yearMin: stats?.yearMin,
    yearMax: stats?.yearMax,
    openAccess: stats?.openAccess ?? papers.filter(paper => paper.openAccess).length,
    sourceCount: sources.filter(source => source.status === 'done' && source.count > 0).length
  }), [stats, papers, sources]);

  return (
    <div className={`app ${view}`}>
      <div className="scroll-progress" ref={scrollProgressRef} />
      <header className="topbar">
        <button type="button" className="brand" onClick={goHome} aria-label="返回 PRISM 首页">
          <span className="brand-mark"><i /><i /><i /></span>
          <span className="brand-name">PRISM</span>
          <span className="brand-sub">文献智能</span>
        </button>
        {view === 'home' ? (
          <nav className="topnav">
            <a href="#method">方法</a>
            <a href="#output">产出</a>
            <span className={`system-state ${llmReady === false ? 'warn' : ''}`}>
              <i className="live-dot" />
              {llmReady === false ? '启发式模式' : 'DeepSeek 在线'}
            </span>
            <button type="button" className="command-trigger" onClick={() => setPaletteOpen(true)}>
              <Icon name="command" size={13} />
              <span>命令</span>
              <kbd>{MOD_KEY}</kbd>
            </button>
          </nav>
        ) : (
          <div className="topbar-run">
            <button type="button" className="command-trigger compact" onClick={() => setPaletteOpen(true)} aria-label="打开命令面板">
              <Icon name="command" size={13} />
              <kbd>{MOD_KEY}</kbd>
            </button>
            <span className="run-id">研究编号 / {jobId || '......'}</span>
            <button type="button" className="secondary-button small" onClick={goHome}>
              <Icon name="plus" size={13} /> 新研究
            </button>
          </div>
        )}
      </header>

      {view === 'home' ? (
        <main className="home">
          <AmbientCanvas />
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> 多智能体文献智能</div>
              <h1>先找到空白，<br /><span>再开始写作。</span></h1>
              <p className="hero-sub">
                输入一个研究课题。PRISM 会派出检索、分析、综述三个层级的智能体，
                把散落的论文整理成可引用的要点、原文入口，以及这个领域还没解决的问题。
              </p>
              <Composer value={topic} onChange={setTopic} onSubmit={() => start()} loading={running} examples={EXAMPLES} />
              <div className="hero-meta">
                <div><strong>03</strong><span>学术数据源</span></div>
                <div><strong>07</strong><span>智能体协同</span></div>
                <div><strong>01</strong><span>研究简报，而非链接堆</span></div>
              </div>
            </div>
            <div className="hero-instrument">
              <div className="instrument-head">
                <span className="mono-label">研究仪表</span>
                <span className="mono-label">v0.2 / 最小可用版</span>
              </div>
              <OrbitCanvas />
              <div className="instrument-foot">
                <span>规划 → 检索 → 精读 → 综合 → 核查</span>
                <span className="instrument-status"><i /> 待命</span>
              </div>
            </div>
          </section>

          <section className="method-strip" id="method">
            <div className="strip-head">
              <span className="mono-label">方法</span>
              <p>不是给模型一个搜索框，而是给研究一个可追踪的执行链。</p>
            </div>
            <div className="method-grid">
              <article>
                <span className="method-index">01 / 框定</span>
                <h3>先把问题拆成镜头</h3>
                <p>规划智能体把模糊的课题翻译成可检索的英文查询，并给出四个分析维度：基础、方法、证据、前沿。</p>
              </article>
              <article>
                <span className="method-index">02 / 检索</span>
                <h3>三个源，并行扫描</h3>
                <p>Semantic Scholar、DOAJ、Crossref 三路检索智能体同时工作；按 DOI 与标题去重，保留引用信号与摘要完整度。</p>
              </article>
              <article>
                <span className="method-index">03 / 综合</span>
                <h3>把论文变成可写的判断</h3>
                <p>证据分析逐篇抽取方法、发现与局限；综合编辑组织主题、分歧与未解问题；引用核查复核引用。</p>
              </article>
            </div>
          </section>

          <section className="output-strip" id="output">
            <div className="output-copy">
              <span className="mono-label">产出</span>
              <h2>一张能直接带进写作的<br />文献作战地图。</h2>
              <p>每条判断都尽量挂回论文编号；每个未解问题都给出可操作的研究角度；每篇论文都保留原文入口。</p>
            </div>
            <div className="output-list">
              <div><span>01</span><strong>核心主题</strong><p>3–5 条有证据的主题线，而不是摘要堆叠。</p></div>
              <div><span>02</span><strong>未解问题</strong><p>领域痛点、证据缺口与可切入的研究角度。</p></div>
              <div><span>03</span><strong>阅读路径</strong><p>按进入领域的顺序排好 5–7 篇关键论文。</p></div>
              <div><span>04</span><strong>可导出简报</strong><p>一键导出 Markdown，直接进入写作或组会。</p></div>
            </div>
          </section>

          <footer className="home-footer">
            <span>PRISM / 最小可用版 0.2</span>
            <span>Semantic Scholar · DOAJ · Crossref · DeepSeek</span>
            <span>研究是循环，不是一次查询。</span>
          </footer>
        </main>
      ) : (
        <main className="research">
          <section className="research-head">
            <div className="research-title">
              <div className="research-kicker">
                <span className={`live-dot ${running ? 'running' : ''}`} />
                {running ? '研究进行中' : '研究已完成'}
                <span className="run-divider">/</span>
                <span>{timeLabel}</span>
              </div>
              <h1>{activeTopic}</h1>
              <div className="research-stats">
                <Stat label="文献" value={statsView.papers} />
                <Stat label="来源" value={statsView.sourceCount} suffix="/ 3" />
                <Stat label="年份" value={statsView.yearMin && statsView.yearMax ? `${statsView.yearMin}–${statsView.yearMax}` : '—'} />
                <Stat label="开放" value={statsView.openAccess} />
                <Stat label="置信度" value={quality ? confidenceLabel(quality.confidence) : (running ? '…' : '—')} accent />
              </div>
            </div>
            <div className="research-actions">
              <button type="button" className="secondary-button small" onClick={exportBrief} disabled={!result}>
                <Icon name="download" size={13} /> 导出 .md
              </button>
              <button type="button" className="secondary-button small" onClick={goHome}>
                <Icon name="plus" size={13} /> 新建
              </button>
            </div>
          </section>

          {running && (
            <div className="run-strip" role="status" aria-live="polite">
              <span className="run-pulse" />
              <span>{stages.find(stage => stage.status === 'running')?.detail || '正在唤醒智能体网络…'}</span>
              <span className="run-progress">{progress}%</span>
              <span className="run-track"><i style={{ width: `${progress}%` }} /></span>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <Icon name="alert" size={15} />
              <span>{error}</span>
              <button type="button" onClick={() => start(activeTopic)}>重试</button>
            </div>
          )}

          <ResearchTelemetry papers={papers} sources={sources} stats={stats} quality={quality} running={running} />

          <div className="research-grid">
            <AgentRail stages={stages} plan={plan} quality={quality} sources={sources} />
            <section className="workspace">
              <div className="tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'brief'} aria-keyshortcuts="1" title="简报 (1)" className={tab === 'brief' ? 'active' : ''} onClick={() => setTab('brief')}>
                  简报
                </button>
                <button type="button" role="tab" aria-selected={tab === 'papers'} aria-keyshortcuts="2" title="文献 (2)" className={tab === 'papers' ? 'active' : ''} onClick={() => setTab('papers')}>
                  文献 <span>{papers.length}</span>
                </button>
                <button type="button" role="tab" aria-selected={tab === 'graph'} aria-keyshortcuts="3" title="图谱 (3)" className={tab === 'graph' ? 'active' : ''} onClick={() => setTab('graph')}>
                  图谱
                </button>
                <button type="button" role="tab" aria-selected={tab === 'trace'} aria-keyshortcuts="4" title="轨迹 (4)" className={tab === 'trace' ? 'active' : ''} onClick={() => setTab('trace')}>
                  轨迹
                </button>
                <span className={`tab-state ${running ? 'running' : ''}`}>{running ? '实时' : '已封存'}</span>
              </div>
              <div className="tab-panel">
                {tab === 'brief' && <BriefView brief={brief} analysis={analysis} quality={quality} papers={papers} onCite={setSelectedPaper} />}
                {tab === 'papers' && <PapersView papers={papers} onOpen={setSelectedPaper} />}
                {tab === 'graph' && <KnowledgeGraph papers={papers} themes={analysis?.themes || []} onSelectPaper={setSelectedPaper} />}
                {tab === 'trace' && <TraceView entries={trace} />}
              </div>
            </section>
          </div>
        </main>
      )}

      {selectedPaper && (
        <PaperDrawer paper={selectedPaper} insight={insight} onClose={() => setSelectedPaper(null)} />
      )}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={paletteCommands} />
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}
