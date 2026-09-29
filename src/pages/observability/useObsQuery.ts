import { useEffect, useState } from "react";

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

/**
 * Fetch-once-per-key with a per-component cache: a falsy key fetches nothing, and a key
 * seen before is served from the cache, so clicking back and forth doesn't refetch.
 */
export function useObsQuery<T>(maybeKey: string | false | null | undefined, fetcher: () => Promise<T>) {
  const key = maybeKey || null;
  const [store, setStore] = useState<Record<string, { data?: T; error?: string }>>({});
  const entry = key ? store[key] : undefined;
  useEffect(() => {
    if (!key || entry) return;
    let live = true;
    fetcher().then(
      (data) => live && setStore((s) => ({ ...s, [key]: { data } })),
      (e: unknown) => live && setStore((s) => ({ ...s, [key]: { error: errorText(e) } })),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, entry]);
  return {
    data: entry?.data ?? null,
    error: entry?.error ?? null,
    loading: !!key && !entry,
    retry: () =>
      key &&
      setStore((s) => {
        const next = { ...s };
        delete next[key];
        return next;
      }),
  };
}
