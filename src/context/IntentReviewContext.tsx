import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchHomeMetrics } from "../data/api";

interface IntentReviewContextValue {
  /** Threat intents not yet "Acknowledged" (`/home-metrics` → `unacknowledgedTotal`) — the sidebar's red badge. */
  unacknowledgedCount: number;
  loading: boolean;
  /** Re-reads the count from /home-metrics — call after changing a status. */
  refetch: () => void;
}

const Ctx = createContext<IntentReviewContextValue | null>(null);

export function IntentReviewProvider({ children }: { children: ReactNode }) {
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // One call: /home-metrics carries the count, so no paging through /intent-list.
    fetchHomeMetrics(1)
      .then((m) => {
        if (!cancelled) setUnacknowledgedCount(m.unacknowledgedTotal ?? 0);
      })
      .catch((e) => {
        console.warn("[IntentReview] /home-metrics failed", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <Ctx.Provider value={{ unacknowledgedCount, loading, refetch }}>
      {children}
    </Ctx.Provider>
  );
}

/** Falls back to a zero count if no provider is mounted (e.g. pages that don't wrap it). */
export function useIntentReview(): IntentReviewContextValue {
  return (
    useContext(Ctx) ?? { unacknowledgedCount: 0, loading: false, refetch: () => {} }
  );
}
