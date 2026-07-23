/** Maps an app name to a recognisable brand icon (inline SVG). Falls back to a coloured initial. */

interface AppIconProps {
  name: string;
  size?: number;
}

type BrandDef = { bg: string; fg: string; svg: (s: number) => React.ReactNode };

const BRANDS: Record<string, BrandDef> = {
  github: {
    bg: "#24292f",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="#fff">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  gmail: {
    bg: "#fff",
    fg: "#EA4335",
    svg: (s) => (
      <svg width={s * 0.65} height={s * 0.65} viewBox="0 0 24 24" fill="none">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.548l8.073-6.055C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335" />
        <path d="M0 5.457v.913l12 9l12-9v-.913C24 3.434 21.69 2.28 20.073 3.493L12 9.548 3.927 3.493C2.31 2.28 0 3.434 0 5.457z" fill="#FBBC05" />
      </svg>
    ),
  },
  trello: {
    bg: "#0052CC",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="#fff">
        <rect x="2.5" y="2.5" width="8" height="14" rx="1.5" />
        <rect x="13.5" y="2.5" width="8" height="9" rx="1.5" />
      </svg>
    ),
  },
  notion: {
    bg: "#fff",
    fg: "#000",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="#000">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    ),
  },
  slack: {
    bg: "#4A154B",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.527 2.527 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.527 2.527 0 012.521 2.521 2.527 2.527 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.527 2.527 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.527 2.527 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.527 2.527 0 012.52-2.52h6.313A2.528 2.528 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#fff" />
      </svg>
    ),
  },
  linear: {
    bg: "#5E6AD2",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="#fff">
        <path d="M0 14.448L9.552 24l14.439-14.439L14.448 0 0 14.448zm.613 1.775l7.164 7.164L21.59 10.174l-7.165-7.165L.613 16.223zM14.448.613l8.939 8.94.613-.613L14.448 0l-.613.613zM0 14.448l.613-.613L0 13.223v1.225z" />
      </svg>
    ),
  },
  figma: {
    bg: "#F24E1E",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.55} height={s * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4z" fill="#0ACF83" />
        <path d="M4 12c0-2.208 1.792-4 4-4h4v8H8c-2.208 0-4-1.792-4-4z" fill="#A259FF" />
        <path d="M4 4c0-2.208 1.792-4 4-4h4v8H8C5.792 8 4 6.208 4 4z" fill="#F24E1E" />
        <path d="M12 0h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V0z" fill="#FF7262" />
        <path d="M20 12c0 2.208-1.792 4-4 4s-4-1.792-4-4 1.792-4 4-4 4 1.792 4 4z" fill="#1ABCFE" />
      </svg>
    ),
  },
  jira: {
    bg: "#0052CC",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M11.53 0L5.8 5.734 3.205 3.139.0 6.345l3.205 3.205 5.75-5.75 8.613 8.614L24 5.608 11.53 0z" fill="#2684FF" />
        <path d="M11.53 12.028L5.796 17.76l-2.597-2.597L0 18.37l3.205 3.205 5.75-5.75L17.568 24l6.406-6.406-12.444-5.566z" fill="#2684FF" />
      </svg>
    ),
  },
  asana: {
    bg: "#F06A6A",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="#fff">
        <circle cx="12" cy="5" r="4.5" />
        <circle cx="5" cy="16" r="4.5" />
        <circle cx="19" cy="16" r="4.5" />
      </svg>
    ),
  },
  dropbox: {
    bg: "#0061FF",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="#fff">
        <path d="M6 1.5L0 5.25l6 3.75 6-3.75L6 1.5zM18 1.5l-6 3.75 6 3.75 6-3.75L18 1.5zM0 12.75L6 16.5l6-3.75-6-3.75L0 12.75zM18 9l-6 3.75 6 3.75 6-3.75L18 9zM6 17.625L12 21.375l6-3.75-6-3.75-6 3.75z" />
      </svg>
    ),
  },
  hubspot: {
    bg: "#FF7A59",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="#fff">
        <path d="M15.39 8.54V5.77A2.1 2.1 0 0016.45 4a2.1 2.1 0 10-4.2 0 2.1 2.1 0 001.06 1.83v2.65a5.97 5.97 0 00-2.76 1.22L4.05 5.73a2.34 2.34 0 10-1.3 1.34l6.36 3.9A5.97 5.97 0 008.55 14a6 6 0 109.43-4.91l-.59-.55zM14.55 17a3 3 0 11-3-3 3 3 0 013 3z" />
      </svg>
    ),
  },
  salesforce: {
    bg: "#00A1E0",
    fg: "#fff",
    svg: (s) => (
      <svg width={s * 0.65} height={s * 0.65} viewBox="0 0 24 24" fill="#fff">
        <path d="M10.005 3.24a5.52 5.52 0 013.957-1.68 5.52 5.52 0 015.17 3.6 4.14 4.14 0 011.308-.21 4.17 4.17 0 014.17 4.17 4.17 4.17 0 01-4.17 4.17H6.75a3.75 3.75 0 01-.165-7.497 5.52 5.52 0 013.42-2.553z" />
      </svg>
    ),
  },
};

function matchBrand(name: string): BrandDef | null {
  const lower = name.toLowerCase();
  for (const [key, def] of Object.entries(BRANDS)) {
    if (lower.includes(key)) return def;
  }
  return null;
}

const FALLBACK_COLORS = [
  "#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626",
  "#0891B2", "#4F46E5", "#BE185D", "#0D9488", "#92400E",
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export function AppIcon({ name, size = 28 }: AppIconProps) {
  const brand = matchBrand(name);
  const radius = Math.round(size * 0.28);

  if (brand) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: brand.bg, display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {brand.svg(size)}
      </div>
    );
  }

  // Fallback: coloured square with first initial
  const initial = (name || "?").trim()[0].toUpperCase();
  const bg = colorForName(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: bg, display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: Math.round(size * 0.44), fontWeight: 700,
      fontFamily: "var(--font-body)", letterSpacing: 0,
    }}>
      {initial}
    </div>
  );
}
