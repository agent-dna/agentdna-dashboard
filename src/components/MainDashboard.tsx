import { useState, useEffect } from "react";
import type { AgentInfo, InteractiontInfo } from "../types";
import { BACKEND_URL } from "../App";
import {
  Bot, Brain, Cpu, Database,
  Shield, Zap, HardDrive, Code, Cloud, Terminal,
} from "lucide-react";
import { epochToGMT } from "../helper/epochToTime";

interface MainDashboardProps {
  onOpenAgent: (id: string) => void;
  onOpenTool: (id: string) => void;
}

const PAGE_SIZE = 10;

const AGENT_ICONS = [Bot, Brain, Cpu, Shield, Bot];
const TOOL_ICONS = [Terminal, Cloud, Zap, HardDrive, Code, Database];

function getAgentStatus(reliability: number) {
  if (reliability >= 99) return { label: "Optimal", color: "text-primary-fixed", bg: "bg-primary-fixed/10" };
  if (reliability >= 95) return { label: "Active", color: "text-primary-fixed", bg: "bg-primary-fixed/10" };
  if (reliability >= 80) return { label: "Throttled", color: "text-[#FF9E22]", bg: "bg-[#FF9E22]/10" };
  return { label: "Degraded", color: "text-error", bg: "bg-error/10" };
}

function computeReliability(total: number, intrusions: number): number {
  if (total === 0) return 0;
  return Number((((total - intrusions) / total) * 100).toFixed(2));
}

const btnStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 6,
  border: active ? "1px solid #44fcdd" : "1px solid rgba(255,255,255,0.2)",
  background: active ? "rgba(68,252,221,0.15)" : "rgba(255,255,255,0.06)",
  color: active ? "#44fcdd" : "#e9f0ff",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "inherit",
});

interface PaginationBarProps {
  page: number;
  total: number;
  setPage: (p: number) => void;
}

const PaginationBar = ({ page, total, setPage }: PaginationBarProps) => {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="flex justify-center items-center gap-2 py-5 flex-wrap">
      <button disabled={page === 1} onClick={() => setPage(page - 1)} style={btnStyle(false)}>
        ← Prev
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button key={p} onClick={() => setPage(p)} style={btnStyle(p === page)}>
          {p}
        </button>
      ))}
      <button disabled={page === pages} onClick={() => setPage(page + 1)} style={btnStyle(false)}>
        Next →
      </button>
    </div>
  );
};

const MainDashboard = ({ onOpenAgent, onOpenTool }: MainDashboardProps) => {
  const [metricsData, setMetricsData] = useState({
    agentsSecured: 0,
    globalTotalInteractions: 0,
    globalIntrusions: 0,
    globalRemoteAgents: 0,
  });

  const [interactionsPage, setInteractionsPage] = useState(1);
  const [agentsPage, setAgentsPage] = useState(1);
  const [toolsPage, setToolsPage] = useState(1);

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [toolsData, setToolsData] = useState<AgentInfo[]>([]);
  const [agentsData, setAgentsData] = useState<AgentInfo[]>([]);
  const [interactionsData, setInteractionsData] = useState<InteractiontInfo[]>([]);

  const fetchTools = async (
    setter: (data: AgentInfo[]) => void,
    setLoading?: (v: boolean) => void
  ) => {
    try {
      setLoading?.(true);
      const res = await fetch(`${BACKEND_URL}/tools`);
      const json = await res.json();
          if (!json.status || !Array.isArray(json.data)) { setter([]); return; }
      const tools: AgentInfo[] = json.data.map((tool: any) => ({
            agent_name: tool.tool_name,
            agent_did: tool.tool_did,
            total_interactions: tool.total_interactions,
            intrusion_count: tool.total_intrusions,
            agents_interacted: tool.agents_interacted,
            reliability_factor: computeReliability(tool.total_interactions, tool.total_intrusions),
          }));
          // sort by total interactions (descending)
          tools.sort((a, b) => (b.total_interactions || 0) - (a.total_interactions || 0));
          setter(tools);
    } catch { setter([]); } finally { setLoading?.(false); }
  };

  const fetchAgents = async (
    setter: (data: AgentInfo[]) => void,
    setLoading?: (v: boolean) => void
  ) => {
    try {
      setLoading?.(true);
      const res = await fetch(`${BACKEND_URL}/agents`);
      const json = await res.json();
          if (!json.status || !Array.isArray(json.data)) { setter([]); return; }
      const agents: AgentInfo[] = json.data.map((agent: any) => ({
            agent_name: agent.agent_name,
            agent_did: agent.agent_did,
            total_interactions: agent.total_interactions,
            intrusion_count: agent.total_intrusions,
            agents_interacted: agent.tools_interacted,
            reliability_factor: computeReliability(agent.total_interactions, agent.total_intrusions),
          }));
          // sort by total interactions (descending)
          agents.sort((a, b) => (b.total_interactions || 0) - (a.total_interactions || 0));
          setter(agents);
    } catch { setter([]); } finally { setLoading?.(false); }
  };

  useEffect(() => {
    const fetchInteractions = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/interactions`);
        const json = await res.json();
        if (!json.status || !json.data) { setInteractionsData([]); return; }
        setInteractionsData(Array.isArray(json.data) ? json.data : []);
      } catch { setInteractionsData([]); }
    };

    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/metrics`);
        const json = await res.json();
        if (!json.status || !json.data) return;
        setMetricsData({
          agentsSecured: json.data.total_agents,
          globalTotalInteractions: json.data.total_interactions,
          globalIntrusions: json.data.total_intrusions,
          globalRemoteAgents: json.data.total_tools,
        });
      } catch { /* keep defaults */ }
    };

    fetchMetrics();
    fetchInteractions();
  }, []);

  useEffect(() => {
    fetchAgents(setAgentsData, setIsLoadingList);
    fetchTools(setToolsData, setIsLoadingList);
  }, []);

  useEffect(() => {
    const iPages = Math.max(1, Math.ceil(interactionsData.length / PAGE_SIZE));
    if (interactionsPage > iPages) setInteractionsPage(iPages);
    const aPages = Math.max(1, Math.ceil(agentsData.length / PAGE_SIZE));
    if (agentsPage > aPages) setAgentsPage(aPages);
    const tPages = Math.max(1, Math.ceil(toolsData.length / PAGE_SIZE));
    if (toolsPage > tPages) setToolsPage(tPages);
  }, [interactionsData, agentsData, toolsData]);

  const interactionsSlice = interactionsData.slice((interactionsPage - 1) * PAGE_SIZE, interactionsPage * PAGE_SIZE);
  const agentsSlice = agentsData.slice((agentsPage - 1) * PAGE_SIZE, agentsPage * PAGE_SIZE);
  const toolsSlice = toolsData.slice((toolsPage - 1) * PAGE_SIZE, toolsPage * PAGE_SIZE);

  const syncPct = metricsData.globalTotalInteractions > 0
    ? (((metricsData.globalTotalInteractions - metricsData.globalIntrusions) / metricsData.globalTotalInteractions) * 100).toFixed(1)
    : "—";

  return (
    <div className="pb-20 space-y-12">

      {/* ── STATUS HEADER ── */}
      <header className="w-full flex flex-col mt-5 items-start gap-4 text-left py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 justify-start">
            <div className="w-2 h-2 rounded-full bg-primary-fixed shadow-[0_0_10px_#44fcdd]"></div>
            <span className="font-headline text-xs tracking-[0.3em] uppercase text-primary-fixed">System Overview</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-headline font-bold tracking-tighter text-on-surface leading-none">DASHBOARD</h1>
        </div>
      </header>

      {/* ── PULSE LINE ── */}
      <div className="pulse-line">
        <div className="pulse-dot"></div>
      </div>

      {/* ── METRICS GRID ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Secured Agents", value: metricsData.agentsSecured },
          { label: "Total Interactions", value: metricsData.globalTotalInteractions },
          { label: "Intrusions Detected", value: metricsData.globalIntrusions },
          { label: "Total Tools", value: metricsData.globalRemoteAgents },
        ].map((m) => (
          <div key={m.label} className="dashboard-card rounded-xl p-5 border border-outline-variant/40">
            <span className="block text-[10px] font-headline text-on-surface-variant uppercase tracking-widest mb-2">
              {m.label}
            </span>
            <span className="text-3xl font-headline font-bold text-primary-fixed">
              {m.value.toLocaleString()}
            </span>
          </div>
        ))}
      </section>


      {/* ── AGENT REGISTRY ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-headline font-bold tracking-tight text-on-surface">
            Secured Agents
          </h3>
          <span className="text-xs font-headline tracking-[0.2em] text-on-surface-variant uppercase">
            {metricsData.agentsSecured} agents
          </span>
        </div>
        {isLoadingList ? (
          <div className="text-on-surface-variant py-8 text-center">Loading agents…</div>
        ) : agentsData.length === 0 ? (
          <div className="text-on-surface-variant py-8 text-center">No agents found</div>
        ) : (
          <>
            <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar snap-x">
              {agentsSlice.map((agent, idx) => {
                const Icon = AGENT_ICONS[idx % AGENT_ICONS.length];
                const reliability = agent.reliability_factor ?? computeReliability(agent.total_interactions, agent.intrusion_count);
                const status = getAgentStatus(reliability);
                const displayName = agent.agent_name?.trim() || agent.agent_did;
                return (
                  <div
                    key={agent.agent_did}
                    onClick={() => onOpenAgent(agent.agent_did)}
                    className="dashboard-card snap-start min-w-[300px] p-6 rounded-xl border-t-2 border-primary-fixed/30 group cursor-pointer border border-outline-variant/30"
                  >
                    <div className="flex justify-between items-center mb-5">
                      <div className="w-11 h-11 bg-surface-container-high rounded-lg flex items-center justify-center">
                        <Icon className="text-primary-fixed" size={22} />
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-headline text-on-surface-variant uppercase">Reliability</span>
                        <span className={`text-xl font-headline ${status.color}`}>
                          {reliability.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <h4 className="text-base font-headline font-bold mb-1 text-on-surface truncate">
                      {displayName}
                    </h4>
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Interactions</span>
                        <span className="text-on-surface font-headline">{agent.total_interactions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Intrusions</span>
                        <span className="text-on-surface font-headline">{agent.intrusion_count}</span>
                      </div>
                      {/* status removed per UX request */}
                    </div>
                  </div>
                );
              })}
            </div>
            <PaginationBar page={agentsPage} total={agentsData.length} setPage={setAgentsPage} />
          </>
        )}
      </section>

      {/* ── TOOL INVENTORY ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-headline font-bold tracking-tight text-on-surface">
            Secured Tools 
          </h3>
          <span className="text-xs font-headline tracking-[0.2em] text-on-surface-variant uppercase">
            {metricsData.globalRemoteAgents} tools
          </span>
        </div>
        {isLoadingList ? (
          <div className="text-on-surface-variant py-8 text-center">Loading tools…</div>
        ) : toolsData.length === 0 ? (
          <div className="text-on-surface-variant py-8 text-center">No tools found</div>
        ) : (
          <>
            <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar snap-x">
              {toolsSlice.map((tool, idx) => {
                const Icon = TOOL_ICONS[idx % TOOL_ICONS.length];
                const reliability = tool.reliability_factor ?? computeReliability(tool.total_interactions, tool.intrusion_count);
                const status = getAgentStatus(reliability);
                const displayName = tool.agent_name?.trim() || tool.agent_did;
                return (
                  <div
                    key={tool.agent_did}
                    onClick={() => onOpenTool(tool.agent_did)}
                    className="dashboard-card snap-start min-w-[260px] p-6 rounded-xl group relative overflow-hidden cursor-pointer border border-outline-variant/30"
                  >
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <Icon size={110} />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center">
                        <Icon className="text-primary-fixed" size={20} />
                      </div>
                      <h4 className="font-headline font-bold text-on-surface truncate">{displayName}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[10px] font-headline text-on-surface-variant uppercase">Reliability</span>
                        <span className={`text-lg font-headline ${status.color}`}>
                          {reliability.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-headline text-on-surface-variant uppercase">Intrusions</span>
                        <span className="text-lg font-headline text-on-surface">{tool.intrusion_count}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-headline text-on-surface-variant uppercase">Interactions</span>
                        <span className="text-sm font-headline text-on-surface">{tool.total_interactions.toLocaleString()}</span>
                      </div>
                      {/* status removed per UX request */}
                    </div>
                  </div>
                );
              })}
            </div>
            <PaginationBar page={toolsPage} total={toolsData.length} setPage={setToolsPage} />
          </>
        )}
      </section>

      {/* ── INTERACTIONS LOG ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-headline font-bold tracking-tight text-on-surface">
            Recent Interactions
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-headline tracking-[0.2em] text-on-surface-variant uppercase">
              {interactionsData.length} Total
            </span>
            {interactionsData.length > PAGE_SIZE && (
              <PaginationBar
                page={interactionsPage}
                total={interactionsData.length}
                setPage={setInteractionsPage}
              />
            )}
          </div>
        </div>

        {isLoadingList ? (
          <div className="text-on-surface-variant py-8 text-center">Loading interactions…</div>
        ) : interactionsData.length === 0 ? (
          <div className="text-on-surface-variant py-8 text-center">No interactions found</div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-outline-variant/30" style={{ background: "#131313" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
                <thead>
                  <tr className="border-b border-outline-variant/30" style={{ background: "#1c1b1b" }}>
                    <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">#</th>
                    <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Time (UTC)</th>
                    <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Agent</th>
                    <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Tool</th>
                    <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant text-right">Intrusion</th>
                  </tr>
                </thead>
                <tbody>
                  {interactionsSlice.map((interaction, idx) => {
                    const hasIntrusion = Boolean(interaction.intrusion_cause);
                    const hostName = interaction.host_name?.trim() || interaction.host_did;
                    const remoteName = interaction.remote_name?.trim() || interaction.remote_did;
                    const time = epochToGMT(interaction.epoch);
                    return (
                      <tr
                        key={idx}
                        style={{
                          background: hasIntrusion ? "rgba(180, 30, 50, 0.18)" : "rgba(10, 90, 70, 0.15)",
                          borderLeft: hasIntrusion ? "3px solid #e05a6f" : "3px solid rgba(68,252,221,0.35)",
                        }}
                        className="transition-all hover:brightness-110 cursor-default"
                      >
                        <td className="px-6 py-4 text-sm font-headline text-on-surface-variant">
                          {(interactionsPage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-6 py-4 text-sm font-headline text-on-surface">{time}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Bot className="text-primary-fixed shrink-0" size={16} />
                            <span className="font-medium text-on-surface text-sm">{hostName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Zap className="text-on-surface-variant shrink-0" size={16} />
                            <span className="text-on-surface-variant text-sm">{remoteName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {hasIntrusion ? (
                            <span className="text-[10px] font-headline uppercase tracking-widest px-3 py-1 rounded-full text-error bg-error/10">
                              {interaction.intrusion_cause}
                            </span>
                          ) : (
                            <span className="text-[10px] font-headline uppercase tracking-widest px-3 py-1 rounded-full text-on-surface-variant bg-surface-container-high">
                              None
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

    </div>
  );
};

export default MainDashboard;
