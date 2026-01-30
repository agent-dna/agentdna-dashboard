import { useEffect, useState } from "react";
import type { AgentInfo, InteractiontInfo } from "../types";
import { AgentListItem } from "../components/AgentList";
import { ToolListItem } from "../components/ToolsList";
import { InteractionsListItem } from "../components/InteractionsList";
import { BACKEND_URL } from "../App";

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

  // 1. Fetch interactions for specific email
  useEffect(() => {
    const fetchByEmail = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/interactions/user/${encodeURIComponent(email)}/agents`,
        );
        const json = await res.json();
        if (!json.status) {
          console.log("test7");
          setInteractions([]);
          return;
        }

        setInteractions(json.data);
      } catch {
        setInteractions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchByEmail();
  }, [email]);

  // 2. Build agents, tools, intrusions from interactions
  useEffect(() => {
    let agentsObj: Record<string, AgentInfo> = {};
    let toolsObj: Record<string, AgentInfo> = {};
    let agentsSetForTools: Record<string, Set<string>> = {};
    let toolsSetForAgents: Record<string, Set<string>> = {};
    let intrusionList: InteractiontInfo[] = [];

    if (interactions == null) {
      return;
    }

    console.log("test8", interactions);
    interactions.forEach((interaction) => {
      if (!interaction.remote_did || !interaction.host_did) {
        return;
      }
      const agentId = interaction.host_did;
      const toolId = interaction.remote_did;

      if (interaction.intrusion_cause) intrusionList.push(interaction);

      agentsSetForTools[agentId] ||= new Set();
      agentsSetForTools[agentId].add(toolId);

      toolsSetForAgents[toolId] ||= new Set();
      toolsSetForAgents[toolId].add(agentId);

      agentsObj[agentId] = {
        agent_name: `${interaction.host_name}`,
        agent_did: agentId,
        total_interactions: (agentsObj[agentId]?.total_interactions || 0) + 1,
        intrusion_count:
          (agentsObj[agentId]?.intrusion_count || 0) +
          (interaction.intrusion_cause ? 1 : 0),
        agents_interacted: agentsSetForTools[agentId].size,
      };

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

    setAgentsData(Object.values(agentsObj));
    setToolsData(Object.values(toolsObj));
    setIntrusionsData(intrusionList);
  }, [interactions]);

  return (
    <div className="main-dashboard">
      {/* Tabs */}
      {/* <div className="tabs">
        <button onClick={() => setActiveTab("interactions")} className={activeTab === "interactions" ? "active" : ""}>Interactions</button>
        <button onClick={() => setActiveTab("agents")} className={activeTab === "agents" ? "active" : ""}>Agents</button>
        <button onClick={() => setActiveTab("tools")} className={activeTab === "tools" ? "active" : ""}>Tools</button>
        <button onClick={() => setActiveTab("intrusions")} className={activeTab === "intrusions" ? "active" : ""}>Intrusions</button>
      </div> */}

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === "interactions" ? "active" : ""}`}
          onClick={() => setActiveTab("interactions")}
        >
          Interactions
        </button>
        <button
          className={`tab-btn ${activeTab === "agents" ? "active" : ""}`}
          onClick={() => setActiveTab("agents")}
        >
          Agents
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
        (isLoading ? (
          <div>Loading Data…</div>
        ) : interactions.length === 0 ? (
          <div>No interactions found</div>
        ) : (
          interactions.map((i, idx) => (
            <InteractionsListItem
              key={idx}
              interaction={i}
              index={idx}
              onClick={() => onOpenAgent(i.host_id)}
            />
          ))
        ))}

      {/* Agents */}
      {activeTab === "agents" &&
        (isLoading ? (
          <div>Loading Data…</div>
        ) : agentsData.length === 0 ? (
          <div>No agents found</div>
        ) : (
          agentsData.map((a, idx) => (
            <AgentListItem
              key={idx}
              agent={a}
              index={idx}
              onClick={() => onOpenAgent(a.agent_did)}
            />
          ))
        ))}

      {/* Tools */}
      {activeTab === "tools" &&
        (isLoading ? (
          <div>Loading Data…</div>
        ) : toolsData.length === 0 ? (
          <div>No tools found</div>
        ) : (
          toolsData.map((t, idx) => (
            <ToolListItem
              key={idx}
              agent={t}
              index={idx}
              onClick={() => onOpenAgent(t.agent_did)}
            />
          ))
        ))}

      {/* Intrusions */}
      {activeTab === "intrusions" &&
        (isLoading ? (
          <div>Loading Data…</div>
        ) : intrusionsData.length === 0 ? (
          <div>No intrusions found</div>
        ) : (
          intrusionsData.map((i, idx) => (
            <InteractionsListItem
              key={idx}
              interaction={i}
              index={idx}
              onClick={() => onOpenAgent(i.host_id)}
            />
          ))
        ))}
    </div>
  );
};

export default EmailPage;
