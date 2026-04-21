import { useEffect, useState } from "react";
import { Bot, Zap, Shield } from "lucide-react";
import type { AgentInfo, InteractiontInfo } from "../types";
import { BACKEND_URL } from "../App";
import { epochToGMT } from "../helper/epochToTime";

const PAGE_SIZE = 10;
type TabType = "interactions" | "agents" | "tools" | "intrusions";

interface EmailPageProps {
  email: string;
  onBack: () => void;
  onOpenAgent: (id: string) => void;
  loading?: boolean;
}

const EmailPage = ({ email, onOpenAgent }: EmailPageProps) => {
  const [interactions, setInteractions] = useState<InteractiontInfo[]>([]);
  const [agentsData, setAgentsData] = useState<AgentInfo[]>([]);
  const [toolsData, setToolsData] = useState<AgentInfo[]>([]);
  const [intrusionsData, setIntrusionsData] = useState<InteractiontInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("interactions");

  const [interactionsPage, setInteractionsPage] = useState(1);
  const [agentsPage, setAgentsPage] = useState(1);
  const [toolsPage, setToolsPage] = useState(1);
  const [intrusionsPage, setIntrusionsPage] = useState(1);

  useEffect(() => {
    const fetchByEmail = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/interactions/user/${encodeURIComponent(email)}/agents`);
        const json = await res.json();
        setInteractions(json.status && Array.isArray(json.data) ? json.data : []);
      } catch {
        setInteractions([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchByEmail();
  }, [email]);

  useEffect(() => {
    const agentsObj: Record<string, AgentInfo> = {};
    const toolsObj: Record<string, AgentInfo> = {};
    const agentsSetForTools: Record<string, Set<string>> = {};
    const toolsSetForAgents: Record<string, Set<string>> = {};
    const intrusionList: InteractiontInfo[] = [];

    interactions.forEach((interaction) => {
      if (!interaction.remote_did || !interaction.host_did) return;
      const agentId = interaction.host_did;
      const toolId = interaction.remote_did;

      if (interaction.intrusion_cause) intrusionList.push(interaction);

      agentsSetForTools[agentId] ||= new Set();
      agentsSetForTools[agentId].add(toolId);
      toolsSetForAgents[toolId] ||= new Set();
      toolsSetForAgents[toolId].add(agentId);

      agentsObj[agentId] = {
        agent_name: interaction.host_name,
        agent_did: agentId,
        total_interactions: (agentsObj[agentId]?.total_interactions || 0) + 1,
        intrusion_count: (agentsObj[agentId]?.intrusion_count || 0) + (interaction.intrusion_cause ? 1 : 0),
        agents_interacted: agentsSetForTools[agentId].size,
      };

      toolsObj[toolId] = {
        agent_name: interaction.remote_name,
        agent_did: toolId,
        total_interactions: (toolsObj[toolId]?.total_interactions || 0) + 1,
        intrusion_count: (toolsObj[toolId]?.intrusion_count || 0) + (interaction.intrusion_cause ? 1 : 0),
        agents_interacted: toolsSetForAgents[toolId].size,
      };
    });

    setAgentsData(Object.values(agentsObj));
    setToolsData(Object.values(toolsObj));
    setIntrusionsData(intrusionList);
  }, [interactions]);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "interactions", label: "Interactions", count: interactions.length },
    { key: "agents", label: "Agents", count: agentsData.length },
    { key: "tools", label: "Tools", count: toolsData.length },
    { key: "intrusions", label: "Intrusions", count: intrusionsData.length },
  ];

  const interactionsSlice = interactions.slice((interactionsPage - 1) * PAGE_SIZE, interactionsPage * PAGE_SIZE);
  const agentsSlice = agentsData.slice((agentsPage - 1) * PAGE_SIZE, agentsPage * PAGE_SIZE);
  const toolsSlice = toolsData.slice((toolsPage - 1) * PAGE_SIZE, toolsPage * PAGE_SIZE);
  const intrusionsSlice = intrusionsData.slice((intrusionsPage - 1) * PAGE_SIZE, intrusionsPage * PAGE_SIZE);

  const Pagination = ({ page, total, setPage }: { page: number; total: number; setPage: (p: number) => void }) => {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
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

  const thClass = "px-6 py-4 font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant";
  const theadStyle = { background: "#1c1b1b" };

  return (
    <div>
      {/* Tabs row — outside the table card */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
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
          {activeTab === "interactions" && <Pagination page={interactionsPage} total={interactions.length} setPage={setInteractionsPage} />}
          {activeTab === "agents" && <Pagination page={agentsPage} total={agentsData.length} setPage={setAgentsPage} />}
          {activeTab === "tools" && <Pagination page={toolsPage} total={toolsData.length} setPage={setToolsPage} />}
          {activeTab === "intrusions" && <Pagination page={intrusionsPage} total={intrusionsData.length} setPage={setIntrusionsPage} />}
        </div>
      </div>

      {/* Table card */}
      <div className="dashboard-card rounded-xl border border-outline-variant/30 overflow-hidden">

      {/* Interactions */}
      {activeTab === "interactions" && (
        isLoading ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">Loading interactions…</div>
        ) : interactions.length === 0 ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">No interactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
              <thead>
                <tr style={theadStyle}>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Time (UTC)</th>
                  <th className={thClass}>Agent</th>
                  <th className={thClass}>Tool</th>
                  <th className={`${thClass} text-right`}>Intrusion</th>
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
                      className="transition-all hover:brightness-110 cursor-default"
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

      {/* Agents */}
      {activeTab === "agents" && (
        isLoading ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">Loading agents…</div>
        ) : agentsData.length === 0 ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">No agents found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
              <thead>
                <tr style={theadStyle}>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Agent Name</th>
                  <th className={thClass}>Reliability</th>
                  <th className={thClass}>Interactions</th>
                  <th className={`${thClass} text-right`}>Intrusions</th>
                </tr>
              </thead>
              <tbody>
                {agentsSlice.map((agent, idx) => {
                  const factor = ((agent.total_interactions - agent.intrusion_count) / agent.total_interactions) * 100;
                  return (
                    <tr
                      key={idx}
                      onClick={() => onOpenAgent(agent.agent_did)}
                      style={{ background: "#131313" }}
                      className="transition-all hover:brightness-110 cursor-pointer"
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
                        {agent.intrusion_count > 0 ? (
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

      {/* Tools */}
      {activeTab === "tools" && (
        isLoading ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">Loading tools…</div>
        ) : toolsData.length === 0 ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">No tools found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
              <thead>
                <tr style={theadStyle}>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Tool Name</th>
                  <th className={thClass}>Reliability</th>
                  <th className={thClass}>Interactions</th>
                  <th className={`${thClass} text-right`}>Intrusions</th>
                </tr>
              </thead>
              <tbody>
                {toolsSlice.map((tool, idx) => {
                  const factor = ((tool.total_interactions - tool.intrusion_count) / tool.total_interactions) * 100;
                  return (
                    <tr
                      key={idx}
                      style={{ background: "#131313" }}
                      className="transition-all hover:brightness-110 cursor-default"
                    >
                      <td className="px-6 py-4 text-sm font-headline text-on-surface-variant">
                        {(toolsPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Zap className="text-primary-fixed shrink-0" size={16} />
                          <span className="font-medium text-on-surface text-sm">{tool.agent_name?.trim() || tool.agent_did}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-headline text-primary-fixed">
                          {Number.isFinite(factor) ? `${factor.toFixed(1)}%` : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface">{tool.total_interactions}</td>
                      <td className="px-6 py-4 text-right">
                        {tool.intrusion_count > 0 ? (
                          <span className="text-[10px] font-headline uppercase tracking-widest px-3 py-1 rounded-full text-error bg-error/10">
                            {tool.intrusion_count}
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

      {/* Intrusions */}
      {activeTab === "intrusions" && (
        isLoading ? (
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
                <tr style={theadStyle}>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Time (UTC)</th>
                  <th className={thClass}>Agent</th>
                  <th className={thClass}>Tool</th>
                  <th className={`${thClass} text-right`}>Cause</th>
                </tr>
              </thead>
              <tbody>
                {intrusionsSlice.map((interaction, idx) => (
                  <tr
                    key={idx}
                    style={{ background: "rgba(180, 30, 50, 0.18)", borderLeft: "3px solid #e05a6f" }}
                    className="transition-all hover:brightness-110 cursor-default"
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

export default EmailPage;
