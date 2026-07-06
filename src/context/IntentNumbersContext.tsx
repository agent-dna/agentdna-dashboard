import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchAllIntents } from "../data/api";

interface IntentNumbersContextValue {
  map: Map<string, number>;
  total: number;
  loading: boolean;
}

const Ctx = createContext<IntentNumbersContextValue | null>(null);

/**
 * Loads every intent once and assigns each intentID a stable sequential number
 * (oldest = #1) so the UI can render "Intent #3" instead of opaque hashes.
 * The actual id stays in the data layer for routing / API calls.
 */
export function IntentNumbersProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllIntents()
      .then((intents) => {
        if (cancelled) return;
        // started is "minutes-ago" — bigger value = older — so ascending sort
        // by started gives oldest-first, which is the natural #1, #2, … order.
        const sorted = [...intents].sort((a, b) => b.started - a.started);
        setIds(sorted.map((i) => i.id));
        setLoading(false);
      })
      .catch((e) => {
        console.warn("[IntentNumbers] fetchAllIntents failed", e);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const map = useMemo(() => {
    const m = new Map<string, number>();
    ids.forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [ids]);

  const value = useMemo<IntentNumbersContextValue>(
    () => ({ map, total: ids.length, loading }),
    [map, ids.length, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIntentNumber(id: string | undefined | null): number | null {
  const ctx = useContext(Ctx);
  if (!id || !ctx) return null;
  return ctx.map.get(id) ?? null;
}

/** @deprecated Use IntentIdChip component instead for table display. */
export function useIntentLabel(): (id: string | undefined | null) => string {
  return (id) => {
    if (!id) return "—";
    return id;
  };
}

function truncateId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}...${id.slice(-3)}`;
}

/** Renders a truncated intent ID with a hover tooltip showing the full value. */
export function IntentIdChip({ id, style }: { id: string | undefined | null; style?: React.CSSProperties }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  if (!id) return <span>—</span>;

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.top - 36 + window.scrollY, left: rect.left + rect.width / 2 + window.scrollX });
    }
    setVisible(true);
  };

  return (
    <>
      <span
        ref={ref}
        style={{ cursor: "default", ...style }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
      >
        {truncateId(id)}
      </span>
      {visible && (
        <span style={{
          position: "absolute",
          top: pos.top,
          left: pos.left,
          transform: "translateX(-50%)",
          background: "#0F2046",
          color: "#C9D6EE",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 500,
          padding: "5px 10px",
          borderRadius: 7,
          border: "1px solid rgba(255,255,255,0.1)",
          whiteSpace: "nowrap",
          zIndex: 9999,
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}>
          {id}
        </span>
      )}
    </>
  );
}
