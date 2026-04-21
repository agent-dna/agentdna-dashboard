import { useEffect, useState } from "react";
import { Bot, Zap, Shield } from "lucide-react";
import type { InteractiontInfo, AgentInfo } from "../types";
import { BACKEND_URL } from "../App";
import { epochToGMT } from "../helper/epochToTime";

const PAGE_SIZE = 10;
type TabType = "interactions" | "agents" | "intrusions";

interface Props {
  selectedAgentName?: string | null;
  selectedAgentDID: string | null;
  onOpenAgent: (id: string) => void;
  onBackToDashboard: () => void;
  onSearchAgent: (id: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
}

const ToolInfoDashboard = ({ selectedAgentDID, onOpenAgent }: Props) => {
  const [activeTab, setActiveTab] = useState<TabType>("interactions");
  const [interactionsData, setInteractionsData] = useState<InteractiontInfo[]>([]);
  const [agentsData, setAgentsData] = useState<AgentInfo[]>([]);
  const [intrusionsData, setIntrusionsData] = useState<InteractiontInfo[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  const [interactionsPage, setInteractionsPage] = useState(1);
  const [agentsPage, setAgentsPage] = useState(1);
  const [intrusionsPage, setIntrusionsPage] = useState(1);

  useEffect(() => {
    if (!selectedAgentDID) return;
    const fetchData = async () => {
      setIsLoadingLocal(true);
      try {
        const res = await fetch(`${BACKEND_URL}/interactions/tool/${selectedAgentDID}`);
        const json = await res.json();
        setInteractionsData(json.status && Array.isArray(json.data) ? json.data : []);
      } catch {
        setInteractionsData([]);
      } finally {
        setIsLoadingLocal(false);
      }
    };
    fetchData();
  }, [selectedAgentDID]);

  useEffect(() => {
    const agentsObj: Record<string, AgentInfo> = {};
    const agentsSetForTools: Record<string, Set<string>> = {};
    const intrusions: InteractiontInfo[] = [];
    interactionsData.forEach((interaction) => {
      const agentId = interaction.host_did;
      if (interaction.intrusion_cause) intrusions.push(interaction);
      agentsSetForTools[agentId] ||= new Set();
      agentsSetForTools[agentId].add(interaction.remote_did!);
      agentsObj[agentId] = {
        agent_name: interaction.host_name,
        agent_did: agentId,
        total_interactions: (agentsObj[agentId]?.total_interactions || 0) + 1,
        intrusion_count: (agentsObj[agentId]?.intrusion_count || 0) + (interaction.intrusion_cause ? 1 : 0),
        agents_interacted: agentsSetForTools[agentId].size,
      };
    });
    setAgentsData(Object.values(agentsObj));
    setIntrusionsData(intrusions);
  }, [interactionsData]);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "interactions", label: "Interactions", count: interactionsData.length },
    { key: "agents", label: "Agents", count: agentsData.length },
    { key: "intrusions", label: "Intrusions", count: intrusionsData.length },
  ];

  const interactionsSlice = interactionsData.slice((interactionsPage - 1) * PAGE_SIZE, interactionsPage * PAGE_SIZE);
  const agentsSlice = agentsData.slice((agentsPage - 1) * PAGE_SIZE, agentsPage * PAGE_SIZE);
  const intrusionsSlice = intrusionsData.slice((intrusionsPage - 1) * PAGE_SIZE, intrusionsPage * PAGE_SIZE);

  const totalPages = (count: number) => Math.max(1, Math.ceil(count / PAGE_SIZE));

  const Pagination = ({ page, total, setPage }: { page: number; total: number; setPage: (p: number) => void }) => {
    const pages = totalPages(total);
    if (pages <= 1) return null;
    return (
      <div className="flex items-center gap-2">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1.5 rounded-lg text-xs font-headline border border-outline-variant/40 text-on-surface-variant hover:text-primary-fixed hover:border-primary-fixed/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`w-8 h-8 rounded-lg text-xs font-headline border transition-colors ${
              p === page
                ? "border-primary-fixed/50 bg-primary-fixed/15 text-primary-fixed"
                : "border-outline-variant/40 text-on-surface-variant hover:text-primary-fixed hover:border-primary-fixed/40"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          disabled={page === pages}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1.5 rounded-lg text-xs font-headline border border-outline-variant/40 text-on-surface-variant hover:text-primary-fixed hover:border-primary-fixed/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* Tabs row — outside the table card */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-xs font-headline uppercase tracking-wider transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? "bg-primary-fixed/15 text-primary-fixed border border-primary-fixed/30"
                  : "text-on-surface-variant hover:text-primary-fixed border border-outline-variant/30"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-primary-fixed/20" : "bg-surface-container"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div>
          {activeTab === "interactions" && (
            <Pagination page={interactionsPage} total={interactionsData.length} setPage={setInteractionsPage} />
          )}
          {activeTab === "agents" && (
            <Pagination page={agentsPage} total={agentsData.length} setPage={setAgentsPage} />
          )}
          {activeTab === "intrusions" && (
            <Pagination page={intrusionsPage} total={intrusionsData.length} setPage={setIntrusionsPage} />
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-outline-variant/30 overflow-hidden">

      {/* Interactions table */}
      {activeTab === "interactions" && (
        isLoadingLocal ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">Loading interactions…</div>
        ) : interactionsData.length === 0 ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">No interactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
              <thead>
                <tr style={{ background: "#1c1b1b" }}>
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
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: hasIntrusion ? "rgba(180, 30, 50, 0.18)" : "rgba(10, 90, 70, 0.15)",
                        borderLeft: hasIntrusion ? "3px solid #e05a6f" : "3px solid rgba(68,252,221,0.35)",
                      }}
                      className="transition-all cursor-default"
                    >
                      <td className="px-6 py-4 text-sm font-headline text-on-surface-variant">
                        {(interactionsPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-6 py-4 text-sm font-headline text-on-surface">{epochToGMT(interaction.epoch)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Bot className="text-primary-fixed shrink-0" size={16} />
                          <span className="font-medium text-on-surface text-sm">{interaction.host_name?.trim() || interaction.host_did}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Zap className="text-on-surface-variant shrink-0" size={16} />
                          <span className="text-on-surface-variant text-sm">{interaction.remote_name?.trim() || interaction.remote_did}</span>
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
        )
      )}

      {/* Agents table */}
      {activeTab === "agents" && (
        isLoadingLocal ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">Loading agents…</div>
        ) : agentsData.length === 0 ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">No agents found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
              <thead>
                <tr style={{ background: "#1c1b1b" }}>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">#</th>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Agent Name</th>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Reliability</th>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Interactions</th>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant text-right">Intrusions</th>
                </tr>
              </thead>
              <tbody>
                {agentsSlice.map((agent, idx) => {
                  const factor = ((agent.total_interactions - agent.intrusion_count) / agent.total_interactions) * 100;
                  const hasIntrusions = agent.intrusion_count > 0;
                  return (
                    <tr
                      key={idx}
                      onClick={() => onOpenAgent(agent.agent_did)}
                      style={{ background: "#131313" }}
                      className="transition-all cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm font-headline text-on-surface-variant">
                        {(agentsPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Bot className="text-primary-fixed shrink-0" size={16} />
                          <span className="font-medium text-on-surface text-sm">{agent.agent_name?.trim() || agent.agent_did}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-headline text-primary-fixed">
                          {Number.isFinite(factor) ? `${factor.toFixed(1)}%` : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface">{agent.total_interactions}</td>
                      <td className="px-6 py-4 text-right">
                        {hasIntrusions ? (
                          <span className="text-[10px] font-headline uppercase tracking-widest px-3 py-1 rounded-full text-error bg-error/10">
                            {agent.intrusion_count}
                          </span>
                        ) : (
                          <span className="text-[10px] font-headline uppercase tracking-widest px-3 py-1 rounded-full text-on-surface-variant bg-surface-container-high">
                            0
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Intrusions table */}
      {activeTab === "intrusions" && (
        isLoadingLocal ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">Loading intrusions…</div>
        ) : intrusionsData.length === 0 ? (
          <div className="py-10 text-center">
            <Shield size={32} className="text-primary-fixed/40 mx-auto mb-3" />
            <p className="text-on-surface-variant text-sm">No intrusions detected</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
              <thead>
                <tr style={{ background: "#1c1b1b" }}>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">#</th>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Time (UTC)</th>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Agent</th>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">Tool</th>
                  <th className="px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant text-right">Cause</th>
                </tr>
              </thead>
              <tbody>
                {intrusionsSlice.map((interaction, idx) => (
                  <tr
                    key={idx}
                    style={{ background: "rgba(180, 30, 50, 0.18)", borderLeft: "3px solid #e05a6f" }}
                    className="transition-all cursor-default"
                  >
                    <td className="px-6 py-4 text-sm font-headline text-on-surface-variant">
                      {(intrusionsPage - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-6 py-4 text-sm font-headline text-on-surface">{epochToGMT(interaction.epoch)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Bot className="text-primary-fixed shrink-0" size={16} />
                        <span className="font-medium text-on-surface text-sm">{interaction.host_name?.trim() || interaction.host_did}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Zap className="text-on-surface-variant shrink-0" size={16} />
                        <span className="text-on-surface-variant text-sm">{interaction.remote_name?.trim() || interaction.remote_did}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[10px] font-headline uppercase tracking-widest px-3 py-1 rounded-full text-error bg-error/10">
                        {interaction.intrusion_cause}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      </div>
    </div>
  );
};

export default ToolInfoDashboard;
