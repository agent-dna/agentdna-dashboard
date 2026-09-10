import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchAllIntents } from "../data/api";

interface IntentReviewContextValue {
  /** Count of intents whose reviewStatus isn't "Acknowledged" — drives the sidebar's red badge. */
  unacknowledgedCount: number;
  loading: boolean;
  /** Re-pulls every intent and recomputes the count — call after changing a status. */
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
    fetchAllIntents()
      .then((intents) => {
        if (cancelled) return;
        setUnacknowledgedCount(intents.filter((i) => i.reviewStatus !== "Acknowledged").length);
      })
      .catch((e) => {
        console.warn("[IntentReview] fetchAllIntents failed", e);
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

/** Falls back to a zero count if no provider is mounted (e.g. dummy mode pages that don't wrap it). */
export function useIntentReview(): IntentReviewContextValue {
  return (
    useContext(Ctx) ?? { unacknowledgedCount: 0, loading: false, refetch: () => {} }
  );
}
