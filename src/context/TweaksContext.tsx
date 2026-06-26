import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Density = "compact" | "comfortable" | "spacious";
export type SidebarMode = "expanded" | "collapsed";
export type ChartStyle = "area" | "line" | "bar";
export type FontFamily = "Inter" | "Geist" | "IBM Plex Sans" | "Manrope" | "DM Sans";

export const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "Inter", label: "Inter" },
  { value: "Geist", label: "Geist" },
  { value: "IBM Plex Sans", label: "IBM Plex Sans" },
  { value: "Manrope", label: "Manrope" },
  { value: "DM Sans", label: "DM Sans" },
];

export interface Tweaks {
  density: Density;
  sidebar: SidebarMode;
  chartStyle: ChartStyle;
  font: FontFamily;
}

const DEFAULTS: Tweaks = {
  density: "spacious",
  sidebar: "expanded",
  chartStyle: "area",
  font: "Inter",
};

const STORAGE_KEY = "agentdna.tweaks";

interface TweaksContextValue {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

const Ctx = createContext<TweaksContextValue | null>(null);

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULTS;
      return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Tweaks>) };
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      // ignore
    }
  }, [tweaks]);

  const setTweak = useCallback(<K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
    setTweaks((t) => ({ ...t, [key]: value }));
  }, []);

  const value = useMemo(() => ({ tweaks, setTweak }), [tweaks, setTweak]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTweaks() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTweaks must be used inside TweaksProvider");
  return v;
}
