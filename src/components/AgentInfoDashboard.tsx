import { useEffect, useState } from "react";
import type { InteractiontInfo, AgentInfo } from "../types";
import { ToolListItem } from "./ToolsList";
import { InteractionsListItem } from "./InteractionsList";
import { BACKEND_URL } from "../App";

const PAGE_SIZE = 5;

type TabType = "interactions" | "tools" | "intrusions";

const btnStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 6,
  border: active ? "1px solid #2ff3e0" : "1px solid rgba(255,255,255,0.2)",
  background: active ? "rgba(47,243,224,0.18)" : "rgba(255,255,255,0.06)",
  color: active ? "#2ff3e0" : "#e9f0ff",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "inherit",
  opacity: 1,
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
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        padding: "20px 0",
        flexWrap: "wrap",
      }}
    >
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

interface AgentInteractionsDashboardProps {
  selectedAgentName?: string | null;
  selectedAgentDID: string | null;
  onOpenTool: (id: string) => void;
  onBackToDashboard: () => void;
  onSearchAgent: (id: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
}

const AgentInteractionsDashboard = ({
  selectedAgentDID,
  onOpenTool,
}: AgentInteractionsDashboardProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("interactions");
  const [interactionsData, setInteractionsData] = useState<InteractiontInfo[]>([]);
  const [toolsData, setToolsData] = useState<AgentInfo[]>([]);
  const [intrusionsData, setIntrusionsData] = useState<InteractiontInfo[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  const [interactionsPage, setInteractionsPage] = useState(1);
  const [toolsPage, setToolsPage] = useState(1);
  const [intrusionsPage, setIntrusionsPage] = useState(1);

  useEffect(() => {
    if (!selectedAgentDID) return;

    const fetchAgentInteractions = async () => {
      setIsLoadingLocal(true);
      try {
        const res = await fetch(`${BACKEND_URL}/interactions/agent/${selectedAgentDID}`);
        const json = await res.json();
        if (!json.status || !Array.isArray(json.data)) {
          setInteractionsData([]);
          return;
        }
        setInteractionsData(json.data);
      } catch {
        setInteractionsData([]);
      } finally {
        setIsLoadingLocal(false);
      }
    };

    fetchAgentInteractions();
  }, [selectedAgentDID]);

  useEffect(() => {
    const toolsObj: Record<string, AgentInfo> = {};
    const toolsSetForAgents: Record<string, Set<string>> = {};
    const intrusions: InteractiontInfo[] = [];

    if (!interactionsData) return;

    interactionsData.forEach((interaction) => {
      const toolId: string = interaction.remote_did!;
      if (interaction.intrusion_cause) intrusions.push(interaction);

      toolsSetForAgents[toolId] ||= new Set();
      toolsSetForAgents[toolId].add(interaction.host_id);

      toolsObj[toolId] = {
        agent_name: `${interaction.remote_name}`,
        agent_did: toolId,
        total_interactions: (toolsObj[toolId]?.total_interactions || 0) + 1,
        intrusion_count:
          (toolsObj[toolId]?.intrusion_count || 0) + (interaction.intrusion_cause ? 1 : 0),
        agents_interacted: toolsSetForAgents[toolId].size,
      };
    });

    setToolsData(Object.values(toolsObj));
    setIntrusionsData(intrusions);
  }, [interactionsData]);

  const interactionsSlice = interactionsData.slice(
    (interactionsPage - 1) * PAGE_SIZE,
    interactionsPage * PAGE_SIZE
  );
  const toolsSlice = toolsData.slice(
    (toolsPage - 1) * PAGE_SIZE,
    toolsPage * PAGE_SIZE
  );
  const intrusionsSlice = intrusionsData.slice(
    (intrusionsPage - 1) * PAGE_SIZE,
    intrusionsPage * PAGE_SIZE
  );

  // Ensure current page indices are valid when data changes.
  useEffect(() => {
    const interactionsPages = Math.max(1, Math.ceil(interactionsData.length / PAGE_SIZE));
    if (interactionsPage > interactionsPages) setInteractionsPage(interactionsPages);
    if (interactionsPage < 1) setInteractionsPage(1);

    const toolsPages = Math.max(1, Math.ceil(toolsData.length / PAGE_SIZE));
    if (toolsPage > toolsPages) setToolsPage(toolsPages);
    if (toolsPage < 1) setToolsPage(1);

    const intrusionsPages = Math.max(1, Math.ceil(intrusionsData.length / PAGE_SIZE));
    if (intrusionsPage > intrusionsPages) setIntrusionsPage(intrusionsPages);
    if (intrusionsPage < 1) setIntrusionsPage(1);
  }, [interactionsData, toolsData, intrusionsData]);

  return (
    <div className="main-dashboard">
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === "interactions" ? "active" : ""}`}
          onClick={() => setActiveTab("interactions")}
        >
          Interactions
        </button>
        <button
          className={`tab-btn ${activeTab === "tools" ? "active" : ""}`}
          onClick={() => setActiveTab("tools")}
        >
          Tools
        </button>
        <button
          className={`tab-btn ${activeTab === "intrusions" ? "active" : ""}`}
          onClick={() => setActiveTab("intrusions")}
        >
          Intrusions
        </button>
      </div>

      {activeTab === "interactions" && (
        isLoadingLocal ? (
          <div className="loading-text">Loading interactions…</div>
        ) : interactionsData.length === 0 ? (
          <div className="empty-text">No interactions found</div>
        ) : (
          <>
            {interactionsSlice.map((i, idx) => (
              <InteractionsListItem
                key={idx}
                interaction={i}
                index={(interactionsPage - 1) * PAGE_SIZE + idx}
              />
            ))}
            <PaginationBar
              page={interactionsPage}
              total={interactionsData.length}
              setPage={setInteractionsPage}
            />
          </>
        )
      )}

      {activeTab === "tools" && (
        isLoadingLocal ? (
          <div className="loading-text">Loading tools…</div>
        ) : toolsData.length === 0 ? (
          <div className="empty-text">No tools found</div>
        ) : (
          <>
            {toolsSlice.map((tool: AgentInfo, idx) => (
              <ToolListItem
                key={idx}
                agent={tool}
                index={(toolsPage - 1) * PAGE_SIZE + idx}
                onClick={() => onOpenTool(tool.agent_did)}
              />
            ))}
            <PaginationBar
              page={toolsPage}
              total={toolsData.length}
              setPage={setToolsPage}
            />
          </>
        )
      )}

      {activeTab === "intrusions" && (
        isLoadingLocal ? (
          <div className="loading-text">Loading intrusions…</div>
        ) : intrusionsData.length === 0 ? (
          <div className="empty-text">No intrusions detected</div>
        ) : (
          <>
            {intrusionsSlice.map((i, idx) => (
              <InteractionsListItem
                key={idx}
                interaction={i}
                index={(intrusionsPage - 1) * PAGE_SIZE + idx}
              />
            ))}
            <PaginationBar
              page={intrusionsPage}
              total={intrusionsData.length}
              setPage={setIntrusionsPage}
            />
          </>
        )
      )}
    </div>
  );
};

export default AgentInteractionsDashboard;
