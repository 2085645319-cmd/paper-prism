import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: string;
  shortcut?: string;
  icon?: IconName;
  keywords?: string;
  disabled?: boolean;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  commands
}: {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands
      .map(command => {
        const haystack = `${command.label} ${command.hint || ''} ${command.group} ${command.keywords || ''}`.toLowerCase();
        const direct = haystack.indexOf(needle);
        const score = command.label.toLowerCase().startsWith(needle) ? 0 : direct >= 0 ? 1 : -1;
        return { command, score };
      })
      .filter(item => item.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map(item => item.command);
  }, [commands, query]);

  useEffect(() => {
    if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1));
  }, [filtered.length, active]);

  if (!open) return null;

  const run = (command: PaletteCommand) => {
    if (command.disabled) return;
    command.run();
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(index => Math.min(filtered.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(index => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = filtered[active];
      if (command) run(command);
    }
  };

  let flatIndex = 0;
  const groups = [...new Set(filtered.map(command => command.group))];

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onMouseDown={event => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="palette-search">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="搜索命令、标签或操作…"
            aria-label="搜索命令"
          />
          <kbd>ESC</kbd>
        </div>

        <div className="palette-list" role="listbox" aria-label="命令列表">
          {groups.map(group => (
            <div className="palette-group" key={group}>
              <span className="palette-group-label">{group}</span>
              {filtered.filter(command => command.group === group).map(command => {
                const index = flatIndex++;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    key={command.id}
                    className={`palette-item ${index === active ? 'active' : ''} ${command.disabled ? 'disabled' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => run(command)}
                    disabled={command.disabled}
                  >
                    <span className="palette-icon">
                      {command.icon ? <Icon name={command.icon} size={14} /> : <span className="palette-bullet" />}
                    </span>
                    <span className="palette-copy">
                      <strong>{command.label}</strong>
                      {command.hint && <small>{command.hint}</small>}
                    </span>
                    {command.shortcut && <kbd>{command.shortcut}</kbd>}
                  </button>
                );
              })}
            </div>
          ))}
          {!filtered.length && (
            <div className="palette-empty">
              <span className="mono-label">没有匹配</span>
              <p>试试“文献”“导出”或“新研究”。</p>
            </div>
          )}
        </div>

        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>↵</kbd> 执行</span>
          <span><kbd>esc</kbd> 关闭</span>
          <span className="palette-brand">PRISM / 命令</span>
        </div>
      </div>
    </div>
  );
}
