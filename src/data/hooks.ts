import { useEffect, useState } from "react";
import * as api from "./api";
import { listUsers, type OrgUser } from "../api/users";
import { fetchAgentPolicyHistory, type PolicyHistory } from "../api/policy";
import type {
  Agent,
  Tool,
  Intent,
  Interaction,
  TimeSeries,
  HeatmapRow,
  LogEntry,
  IntentParticipant,
  HomeMetrics,
} from "../types";

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useAsync<T>(fn: () => Promise<T>, initial: T, deps: unknown[] = []): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ data: T; loading: boolean; error: Error | null }>({
    data: initial,
    loading: true,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: initial, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { ...state, refetch: () => setNonce((n) => n + 1) };
}

export const useUsers = (page = 1) =>
  useAsync<OrgUser[]>(() => listUsers(page).then((r) => r.usersList || []), [], [page]);
export const useAgents = (page = 1) => useAsync<Agent[]>(() => api.fetchAgents(page), [], [page]);
export const useAgentsPaged = (page = 1) =>
  useAsync<api.PagedAgentsResult>(
    () => api.fetchAgentsPaged(page),
    { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
    [page],
  );
export const useTools = (page = 1) => useAsync<Tool[]>(() => api.fetchTools(page), [], [page]);
export const useToolsPaged = (page = 1) =>
  useAsync<api.PagedToolsResult>(
    () => api.fetchToolsPaged(page),
    { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
    [page],
  );
export const useIntents = (page = 1) => useAsync<Intent[]>(() => api.fetchIntents(page), [], [page]);
export const useIntentsPaged = (page = 1) =>
  useAsync<api.PagedIntentsResult>(
    () => api.fetchIntentsPaged(page),
    { items: [], total: 0, page: 1, totalPages: 1 },
    [page],
  );
export const useInteractions = (page = 1) => useAsync<Interaction[]>(() => api.fetchInteractions(page), [], [page]);
export const useInteractionsPaged = (page = 1) =>
  useAsync<api.PagedInteractionsResult>(
    () => api.fetchInteractionsPaged(page),
    { interactions: [], total: 0, totalPages: 1, page: 1, pageSize: 0 },
    [page],
  );
export const useAlerts = (page = 1) => useAsync<Interaction[]>(() => api.fetchAlerts(page), [], [page]);
export const useHomeMetrics = (page = 1) =>
  useAsync<HomeMetrics>(
    () => api.fetchHomeMetrics(page),
    { agentCount: 0, intentCount: 0, interactionsCount: 0, threatCount: 0, page: 1, agentList: [] },
    [page],
  );
export const useSeries = (range: "24h" | "7d") =>
  useAsync<TimeSeries>(() => api.fetchSeries(range), { total: [], safe: [], threats: [] }, [range]);
export const useHeatmap = () => useAsync<HeatmapRow[]>(api.fetchHeatmap, []);

export const useAgent = (id: string) =>
  useAsync<Agent | null>(() => api.fetchAgent(id), null, [id]);
export const useIntent = (id: string) =>
  useAsync<Intent | null>(() => api.fetchIntent(id), null, [id]);
export const useAgentInteractions = (id: string) =>
  useAsync<Interaction[]>(() => api.fetchAgentInteractions(id), [], [id]);
export const useAgentIntents = (id: string) =>
  useAsync<Intent[]>(() => api.fetchAgentIntents(id), [], [id]);
export const useIntentInteractions = (id: string) =>
  useAsync<Interaction[]>(() => api.fetchIntentInteractions(id), [], [id]);

export const useIntentInteractionsPaged = (id: string, page: number) =>
  useAsync<api.PagedIntentInteractionsResult>(
    () => api.fetchIntentInteractionsPaged(id, page),
    { interactions: [], total: 0, totalPages: 1, page: 1 },
    [id, page],
  );
export const useIntentParticipants = (id: string) =>
  useAsync<IntentParticipant[]>(() => api.fetchIntentParticipants(id), [], [id]);
export const useLogs = (kind: "agent" | "intent", id: string) =>
  useAsync<LogEntry[]>(() => api.fetchLogs(kind, id), [], [kind, id]);

export const useAgentPolicyHistory = (id: string) =>
  useAsync<PolicyHistory | null>(
    () => (id ? fetchAgentPolicyHistory(id).catch(() => null) : Promise.resolve(null)),
    null,
    [id],
  );
