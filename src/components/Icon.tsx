import type { SVGProps } from 'react';

export type IconName =
  | 'search' | 'arrow' | 'external' | 'copy' | 'download' | 'close'
  | 'spark' | 'chevron' | 'check' | 'alert' | 'book' | 'graph' | 'list'
  | 'refresh' | 'quote' | 'link' | 'command' | 'filter' | 'plus';

const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
  external: <><path d="M14 5h5v5" /><path d="M19 5 10 14" /><path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" /></>,
  copy: <><rect x="9" y="9" width="10" height="10" rx="2" /><path d="M5 15V6a1 1 0 0 1 1-1h9" /></>,
  download: <><path d="M12 4v11" /><path d="m8 11 4 4 4-4" /><path d="M5 20h14" /></>,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  spark: <><path d="M12 3v4" /><path d="M12 17v4" /><path d="M3 12h4" /><path d="M17 12h4" /><path d="m5.6 5.6 2.8 2.8" /><path d="m15.6 15.6 2.8 2.8" /><path d="m18.4 5.6-2.8 2.8" /><path d="m8.4 15.6-2.8 2.8" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="M12 4 3.5 19h17L12 4Z" /><path d="M12 9v4" /><path d="M12 16.5v.1" /></>,
  book: <><path d="M5 4h6a2 2 0 0 1 2 2v14a3 3 0 0 0-3-3H5V4Z" /><path d="M19 4h-4a2 2 0 0 0-2 2v14a3 3 0 0 1 3-3h3V4Z" /></>,
  graph: <><circle cx="6" cy="7" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="17" r="2" /><path d="m7.6 8.6 3 6.6" /><path d="m16.4 8.6-3 6.6" /><path d="M8 7h8" /></>,
  list: <><path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><circle cx="4" cy="6" r=".7" fill="currentColor" /><circle cx="4" cy="12" r=".7" fill="currentColor" /><circle cx="4" cy="18" r=".7" fill="currentColor" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5v6h-6" /></>,
  quote: <><path d="M9 11H5a4 4 0 0 1 4-4v4Z" /><path d="M9 11v6H5v-6" /><path d="M19 11h-4a4 4 0 0 1 4-4v4Z" /><path d="M19 11v6h-4v-6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.4 1.4" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4" /></>,
  command: <><path d="M9 9v6H6a3 3 0 1 1 3-3V6a3 3 0 1 1-3 3h6" /><path d="M15 9V6a3 3 0 1 1 3 3h-6v6h6a3 3 0 1 1-3 3V9" /></>,
  filter: <><path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
