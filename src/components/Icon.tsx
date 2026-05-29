import type { ReactElement, SVGProps } from "react";

export type IconName =
  | "home"
  | "intents"
  | "agents"
  | "interactions"
  | "alerts"
  | "search"
  | "bell"
  | "settings"
  | "chevron"
  | "chevronDown"
  | "download"
  | "plus"
  | "filter"
  | "arrowRight"
  | "arrowUpRight"
  | "refresh"
  | "close"
  | "sidebar"
  | "more"
  | "eye"
  | "shield"
  | "zap"
  | "activity"
  | "clock"
  | "target"
  | "helix"
  | "box"
  | "copy"
  | "check";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

const PATHS: Record<IconName, ReactElement> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h4v-6h6v6h4V10" />,
  intents: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  agents: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="14" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5M11 20c0-2 1.5-3 3-3.5" />
    </>
  ),
  interactions: (
    <>
      <path d="M4 7h10l-2-2M20 17H10l2 2" />
      <path d="M4 7v0M20 17v0" />
    </>
  ),
  alerts: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1112 0v5l1.5 3h-15L6 13z" />
      <path d="M10 19a2 2 0 004 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14 3h-4l-.6 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L10 21h4l.6-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  download: (
    <>
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </>
  ),
  arrowUpRight: <path d="M7 17L17 7M9 7h8v8" />,
  refresh: (
    <>
      <path d="M3 12a9 9 0 0114-7l4 4" />
      <path d="M21 4v5h-5M21 12a9 9 0 01-14 7l-4-4" />
      <path d="M3 20v-5h5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  sidebar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  zap: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  helix: (
    <>
      <path d="M7 3c0 4 10 4 10 10s-10 6-10 10" />
      <path d="M17 3c0 4-10 4-10 10s10 6 10 10" />
      <path d="M9 6h6M8 9h8M8 15h8M9 18h6" />
    </>
  ),
  box: (
    <>
      <path d="M3 7l9-4 9 4-9 4z" />
      <path d="M3 7v10l9 4M21 7v10l-9 4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  check: <path d="M5 12l5 5 9-11" />,
};

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export function HelixLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="hg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="hg2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A2240" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <path d="M9 4 C 9 10, 23 10, 23 16 S 9 22, 9 28" stroke="url(#hg1)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M23 4 C 23 10, 9 10, 9 16 S 23 22, 23 28" stroke="url(#hg2)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="9" cy="9" r="1.6" fill="#2563EB" />
      <circle cx="23" cy="9" r="1.6" fill="#0EA5E9" />
      <circle cx="9" cy="23" r="1.6" fill="#0A2240" />
      <circle cx="23" cy="23" r="1.6" fill="#2563EB" />
    </svg>
  );
}
