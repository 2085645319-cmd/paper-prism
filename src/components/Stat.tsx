export function Stat({
  label,
  value,
  suffix,
  accent = false
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${accent ? 'accent' : ''}`}>
        {value}
        {suffix && <em>{suffix}</em>}
      </span>
    </div>
  );
}

export function SignalBar({ value }: { value: number }) {
  return (
    <span className="signal-bar" title={`信号 ${value}`}>
      <span style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </span>
  );
}
