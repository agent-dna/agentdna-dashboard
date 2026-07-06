import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

/** Return the raw intent ID as received from the backend. */
export function useIntentLabel(): (id: string | undefined | null) => string {
  return (id) => {
    if (!id) return "—";
    return id;
  };
}

function shortHash(id: string): string {
  const parts = id.split("_");
  const tail = parts.length > 1 ? parts.slice(1).join("_") : id;
  return tail.length > 6 ? tail.slice(-6) : tail;
}
