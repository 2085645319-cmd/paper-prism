import type { AbstractPolicy, ResearchOptions, YearPreset } from '../types';
import { Icon } from './Icon';

const YEAR_OPTIONS: Array<{ value: YearPreset; label: string; short: string; years: number }> = [
  { value: 'recent3', label: '近 3 年', short: '近3年', years: 3 },
  { value: 'recent5', label: '近 5 年', short: '近5年', years: 5 },
  { value: 'recent10', label: '近 10 年', short: '近10年', years: 10 },
  { value: 'all', label: '不限年份', short: '不限', years: 0 }
];

const COUNT_OPTIONS = [12, 18, 24, 30];

const POLICY_OPTIONS: Array<{ value: AbstractPolicy; label: string; hint: string }> = [
  { value: 'prefer', label: '优先摘要', hint: '摘要影响排序，无摘要也可入选' },
  { value: 'require', label: '必须有摘要', hint: '只看有摘要的论文，覆盖更稳但可能更少' },
  { value: 'ignore', label: '标题/元数据', hint: '不按摘要筛选，更看重标题、引用与来源' }
];

const POLICY_LABEL: Record<AbstractPolicy, string> = {
  prefer: '优先摘要',
  require: '必须有摘要',
  ignore: '标题/元数据'
};

const SOURCE_OPTIONS = [
  { id: 'semanticscholar', label: 'Semantic Scholar' },
  { id: 'doaj', label: 'DOAJ' },
  { id: 'crossref', label: 'Crossref' }
];

function yearLabel(preset: YearPreset) {
  if (preset === 'all') return '不限年份';
  const year = new Date().getFullYear();
  const span = preset === 'recent3' ? 3 : preset === 'recent5' ? 5 : 10;
  return `${year - span + 1}–${year}`;
}

function summary(value: ResearchOptions) {
  const parts = [
    yearLabel(value.yearPreset),
    `${value.maxPapers} 篇`,
    POLICY_LABEL[value.abstractPolicy],
    value.includeClassics && value.yearPreset !== 'all' ? '含 1–2 篇经典' : '',
    `${value.sources.length} 个来源`
  ].filter(Boolean);
  return parts.join(' · ');
}

export function describeResearchOptions(value: ResearchOptions) {
  return summary(value);
}

export function ResearchSettings({
  value,
  onChange,
  disabled = false
}: {
  value: ResearchOptions;
  onChange: (next: ResearchOptions) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<ResearchOptions>) => onChange({ ...value, ...patch });

  const toggleSource = (id: string) => {
    const exists = value.sources.includes(id);
    const next = exists ? value.sources.filter(item => item !== id) : [...value.sources, id];
    if (!next.length) return;
    set({ sources: next });
  };

  return (
    <section className={`research-settings ${disabled ? 'disabled' : ''}`} aria-label="研究约束">
      <div className="settings-head">
        <span className="mono-label">研究约束</span>
        <span className="settings-summary">{summary(value)}</span>
      </div>

      <div className="settings-row">
        <span className="settings-label">时间范围</span>
        <div className="segmented">
          {YEAR_OPTIONS.map(option => (
            <button
              type="button"
              key={option.value}
              className={value.yearPreset === option.value ? 'active' : ''}
              onClick={() => set({
                yearPreset: option.value,
                includeClassics: option.value === 'all' ? false : value.includeClassics
              })}
            >
              {option.short}
            </button>
          ))}
        </div>
        <span className="settings-hint">{yearLabel(value.yearPreset)}</span>
      </div>

      <div className="settings-row">
        <span className="settings-label">论文数量</span>
        <div className="segmented">
          {COUNT_OPTIONS.map(count => (
            <button
              type="button"
              key={count}
              className={value.maxPapers === count ? 'active' : ''}
              onClick={() => set({ maxPapers: count })}
            >
              {count}
            </button>
          ))}
        </div>
        <span className="settings-hint">最多 {value.maxPapers} 篇</span>
      </div>

      <div className="settings-row settings-policy-row">
        <span className="settings-label">摘要策略</span>
        <div className="segmented">
          {POLICY_OPTIONS.map(option => (
            <button
              type="button"
              key={option.value}
              className={value.abstractPolicy === option.value ? 'active' : ''}
              onClick={() => set({ abstractPolicy: option.value })}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="settings-hint">{POLICY_OPTIONS.find(option => option.value === value.abstractPolicy)?.hint}</span>
      </div>

      <div className="settings-row settings-toggles">
        <button
          type="button"
          className={`settings-switch ${value.includeClassics ? 'on' : ''}`}
          onClick={() => set({ includeClassics: !value.includeClassics })}
          aria-pressed={value.includeClassics}
          disabled={value.yearPreset === 'all'}
          title={value.yearPreset === 'all' ? '不限年份时无需单独保留经典' : '保留 1–2 篇更早的经典工作'}
        >
          <i />
          保留 1–2 篇经典
        </button>
      </div>

      <div className="settings-row settings-sources">
        <span className="settings-label">来源</span>
        <div className="source-select">
          {SOURCE_OPTIONS.map(source => {
            const active = value.sources.includes(source.id);
            return (
              <button
                type="button"
                key={source.id}
                className={`source-option ${active ? 'active' : ''}`}
                onClick={() => toggleSource(source.id)}
                aria-pressed={active}
              >
                <span className="source-check"><Icon name="check" size={10} /></span>
                {source.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
