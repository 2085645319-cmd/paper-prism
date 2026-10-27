export type StageStatus = 'queued' | 'running' | 'done' | 'skipped' | 'error';

export interface Stage {
  id: string;
  name: string;
  role: string;
  short: string;
  status: StageStatus;
  detail?: string;
}

export interface PlanDimension {
  name: string;
  question: string;
}

export interface ResearchPlan {
  topic_en: string;
  field: string;
  queries: string[];
  dimensions: PlanDimension[];
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  doi: string | null;
  url: string;
  abstract: string;
  citations: number;
  sources: string[];
  type: string;
  openAccess: boolean;
  signal: number;
}

export interface PaperInsight {
  keyPoints: string[];
  method: string;
  finding: string;
  limitation: string;
}

export interface Theme {
  name: string;
  summary: string;
  paperIds: string[];
}

export interface Gap {
  title: string;
  detail: string;
  evidenceIds: string[];
}

export interface Analysis {
  papers: Record<string, PaperInsight>;
  themes: Theme[];
  consensus: string[];
  tensions: string[];
  gaps: Gap[];
  keywords: string[];
  mode: 'llm' | 'heuristic';
}

export interface BriefTheme {
  name: string;
  insight: string;
  paperIds: string[];
}

export interface PainPoint {
  title: string;
  detail: string;
  evidenceIds: string[];
  opportunity: string;
}

export interface FutureDirection {
  title: string;
  detail: string;
  evidenceIds: string[];
}

export interface ReadingItem {
  paperId: string;
  why: string;
}

export interface Brief {
  title: string;
  standfirst: string;
  scope: string;
  keyThemes: BriefTheme[];
  consensus: string[];
  tensions: string[];
  painPoints: PainPoint[];
  futureDirections: FutureDirection[];
  readingPath: ReadingItem[];
  methodNotes: string[];
  caveats: string[];
  mode: 'llm' | 'heuristic';
}

export interface QualityCheck {
  label: string;
  status: 'pass' | 'warn';
  detail: string;
}

export interface Quality {
  confidence: 'high' | 'medium' | 'low';
  checks: QualityCheck[];
  abstractCoverage: number;
  sourceCount: number;
  paperCount: number;
  citedPapers: number;
  invalidCitations: string[];
  mode: 'llm' | 'heuristic';
  tokens: { promptTokens: number; completionTokens: number; totalTokens: number };
  generatedAt: string;
  durationMs: number;
}

export interface SourceStat {
  id: string;
  name: string;
  role: string;
  status: 'done' | 'error' | 'skipped';
  count: number;
  ms: number;
  error?: string;
}

export interface CorpusStats {
  papers: number;
  withAbstract: number;
  openAccess: number;
  citations: number;
  yearMin: number | null;
  yearMax: number | null;
}

export interface ResearchResult {
  topic: string;
  plan: ResearchPlan;
  papers: Paper[];
  analysis: Analysis;
  brief: Brief;
  quality: Quality;
  stats: CorpusStats;
  sources: SourceStat[];
  meta: {
    startedAt: number;
    durationMs: number;
    model: string;
    llm: boolean;
    generatedAt: string;
  };
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface PrismEvent {
  type: string;
  at: number;
  [key: string]: unknown;
}

export interface TraceEntry {
  id: number;
  at: number;
  type: string;
  agent?: string;
  message: string;
}
