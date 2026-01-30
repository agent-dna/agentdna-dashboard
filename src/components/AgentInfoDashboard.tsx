import { useEffect, useState } from "react";
import type { InteractiontInfo, AgentInfo } from "../types";
import { ToolListItem } from "./ToolsList";
import { InteractionsListItem } from "./InteractionsList";
import { BACKEND_URL } from "../App";

type TabType = "interactions" | "tools" | "intrusions";

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
  selectedAgentName,
  onOpenTool,
}: AgentInteractionsDashboardProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("interactions");

  const [interactionsData, setInteractionsData] = useState<InteractiontInfo[]>(
    [],
  );
  const [toolsData, setToolsData] = useState<AgentInfo[]>([]);
  const [intrusionsData, setIntrusionsData] = useState<InteractiontInfo[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  // 1. Fetch interactions where this agent is involved
  useEffect(() => {
    if (!selectedAgentDID) return;

    const fetchAgentInteractions = async () => {
      setIsLoadingLocal(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/interactions/agent/${selectedAgentDID}`,
        );
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

  // 2. Build Tools + Intrusions from interactions
  useEffect(() => {
    console.log("test2", interactionsData);
    let toolsObj: Record<string, AgentInfo> = {};
    let toolsSetForAgents: Record<string, Set<string>> = {};
    let intrusions: InteractiontInfo[] = [];

    if (!interactionsData) {
      console.log("test3", interactionsData);
      return;
    }

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
          (toolsObj[toolId]?.intrusion_count || 0) +
          (interaction.intrusion_cause ? 1 : 0),
        agents_interacted: toolsSetForAgents[toolId].size,
      };
    });

    console.log("test4", interactionsData);
    setToolsData(Object.values(toolsObj));
    setIntrusionsData(intrusions);
  }, [interactionsData]);

  return (
    <div className="main-dashboard">
      {/* Tabs */}
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

      {/* Interactions */}
      {activeTab === "interactions" &&
        (isLoadingLocal ? (
          <div className="loading-text">Loading interactions…</div>
        ) : interactionsData.length === 0 ? (
          <div className="empty-text">No interactions found</div>
        ) : (
          interactionsData.map((i, idx) => (
            <InteractionsListItem
              key={idx}
              interaction={i}
              index={idx}
              onClick={() => {}}
            />
          ))
        ))}

      {/* Tools */}
      {activeTab === "tools" &&
        (isLoadingLocal ? (
          <div className="loading-text">Loading tools…</div>
        ) : toolsData.length === 0 ? (
          <div className="empty-text">No tools found</div>
        ) : (
          toolsData.map((tool: AgentInfo, idx) => (
            <ToolListItem
              key={idx}
              agent={tool}
              index={idx}
              onClick={() => {
                onOpenTool(tool.agent_did);
              }}
            />
          ))
        ))}

      {/* Intrusions */}
      {activeTab === "intrusions" &&
        (isLoadingLocal ? (
          <div className="loading-text">Loading intrusions…</div>
        ) : intrusionsData.length === 0 ? (
          <div className="empty-text">No intrusions detected</div>
        ) : (
          intrusionsData.map((i, idx) => (
            <InteractionsListItem
              key={idx}
              interaction={i}
              index={idx}
              onClick={() => {}}
            />
          ))
        ))}
    </div>
  );
};

export default AgentInteractionsDashboard;
