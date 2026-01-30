import { useState, useEffect } from "react";
import type { AgentInfo, InteractiontInfo } from "../types";
import "./MainDashboard.css";
import { AgentListItem } from "./AgentList";
import { ToolListItem } from "./ToolsList";
import { InteractionsListItem } from "./InteractionsList";
import { BACKEND_URL } from "../App";

interface MainDashboardProps {
  onOpenAgent: (id: string) => void;
  onOpenTool: (id: string) => void;
  onSearchByEmail: (email: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

type TabType = "interactions" | "agents" | "tools";

const MainDashboard = ({
  onOpenAgent,
  onOpenTool,
  onSearchByEmail,
  searchValue,
  onSearchChange,
}: MainDashboardProps) => {
  const [metricsData, setMetricsData] = useState({
    agentsSecured: 0,
    globalTotalInteractions: 0,
    globalIntrusions: 0,
    globalRemoteAgents: 0,
  });

  const [interactions, setInteractions] = useState<InteractiontInfo[]>([]);

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [toolsData, setToolsData] = useState<AgentInfo[]>([]);
  const [agentsData, setAgentsData] = useState<AgentInfo[]>([]);
  const [interactionsData, setInteractionsData] = useState<InteractiontInfo[]>(
    [],
  );

  const [activeTab, setActiveTab] = useState<TabType>("interactions");
   const fetchTools = async (
  setToolsData: (data: AgentInfo[]) => void,
  setLoading?: (v: boolean) => void
) => {
  try {
    setLoading?.(true);

    const res = await fetch(`${BACKEND_URL}/tools`);
    const json = await res.json();

    if (!json.status || !Array.isArray(json.data)) {
      setToolsData([]);
      return;
    }

    const tools: AgentInfo[] = json.data.map((tool: any) => ({
      agent_name: tool.tool_name,
      agent_did: tool.tool_did,
      total_interactions: tool.total_interactions,
      intrusion_count: tool.total_intrusions,
      agents_interacted: tool.agents_interacted,
      reliability_factor: computeReliability(
        tool.total_interactions,
        tool.total_intrusions
      ),
    }));

    setToolsData(tools);
  } catch (err) {
    console.error("Failed to fetch tools", err);
    setToolsData([]);
  } finally {
    setLoading?.(false);
  }
};

 const fetchAgents = async (
  setAgentsData: (data: AgentInfo[]) => void,
  setLoading?: (v: boolean) => void
) => {
  try {
    setLoading?.(true);

    const res = await fetch(`${BACKEND_URL}/agents`);
    const json = await res.json();

    if (!json.status || !Array.isArray(json.data)) {
      setAgentsData([]);
      return;
    }

    const agents: AgentInfo[] = json.data.map((agent: any) => ({
      agent_name: agent.agent_name,
      agent_did: agent.agent_did,
      total_interactions: agent.total_interactions,
      intrusion_count: agent.total_intrusions,
      agents_interacted: agent.tools_interacted,
      reliability_factor: computeReliability(
        agent.total_interactions,
        agent.total_intrusions
      ),
    }));

    setAgentsData(agents);
  } catch (err) {
    console.error("Failed to fetch agents", err);
    setAgentsData([]);
  } finally {
    setLoading?.(false);
  }
};

const computeReliability = (
  total: number,
  intrusions: number
): number => {
  if (total === 0) return 0;
  return Number((((total - intrusions) / total) * 100).toFixed(2));
};


  // -------------------------------------------------------
  // FETCH ALL NFT RECORDS FOR MAIN DASHBOARD
  // -------------------------------------------------------
  useEffect(() => {
    const fetchInteractions = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/interactions`,
        );
  
        const json = await response.json();

         if (!json.status || !json.data) {
          setInteractions([]);
         }

        if (Array.isArray(json.data)) {
          setInteractions(json.data);
          setInteractionsData(json.data);

        } else {
          setInteractions([]);
        }
      } catch {
        setInteractions([]);
      }
    };

    const fetchMetrices = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/metrics`);
        const json = await response.json();

        if (!json.status || !json.data) {
          setMetricsData({
            agentsSecured: 0,
            globalTotalInteractions: 0,
            globalIntrusions: 0,
            globalRemoteAgents: 0,
          });
          return;
        }

        setMetricsData({
          agentsSecured: json.data.total_agents,
          globalTotalInteractions: json.data.total_interactions,
          globalIntrusions: json.data.total_intrusions,
          globalRemoteAgents: json.data.total_tools,
        });
      } catch (err) {
        console.error("Failed to fetch metrics", err);
        setMetricsData({
          agentsSecured: 0,
          globalTotalInteractions: 0,
          globalIntrusions: 0,
          globalRemoteAgents: 0,
        });
      }
    };

    fetchMetrices();

    fetchInteractions();
  }, []);

  // useEffect(() => {
    // const get_Agents_Tools_Metrices = async () => {
    //   try {
    //     const interactions_data = interactions;
    //     let agentsObj: Record<string, AgentInfo> = {};
    //     let toolsObj: Record<string, AgentInfo> = {};
    //     let agentsSetForTools: Record<string, Set<string>> = {};
    //     const toolsSetForAgents: Record<string, Set<string>> = {};

    //     const agentsSet = new Set<string>();
    //     const toolsSet = new Set<string>();
    //     interactions_data.forEach((interaction: InteractiontInfo) => {
    //       console.log("test10 : interactions", interaction)
    //       agentsSet.add(interaction.host_id);
    //       toolsSet.add(interaction.remote_did);

    //       agentsSetForTools[interaction.host_id] =
    //       agentsSetForTools[interaction.host_id] || new Set<string>();
    //       agentsSetForTools[interaction.host_id].add(interaction.remote_did);

    //       toolsSetForAgents[interaction.remote_did] =
    //       toolsSetForAgents[interaction.remote_did] || new Set<string>();
    //       toolsSetForAgents[interaction.remote_did].add(interaction.host_id);
    //       const agentId = interaction.host_did;
    //       const toolId = interaction.remote_did;
    //       const total = (agentsObj[agentId]?.total_interactions || 0) + 1;
    //       const intrusions =
    //         (agentsObj[agentId]?.intrusion_count || 0) +
    //         (interaction.intrusion_cause ? 1 : 0);

    //       const reliability =
    //         total > 0 ? ((total - intrusions) / total) * 100 : 0;
    //         const agentName = interaction.host_name
    //       agentsObj[agentId] = {
    //         agent_name: `${agentName}`,
    //         agent_did: agentId,
    //         total_interactions: total,
    //         intrusion_count: intrusions,
    //         agents_interacted: agentsSetForTools[agentId]?.size || 0,
    //         reliability_factor: Number(reliability.toFixed(2)), // clean UI number
    //       };
    //       const toolTotal = (toolsObj[toolId]?.total_interactions || 0) + 1;
    //       const toolIntrusions =
    //         (toolsObj[toolId]?.intrusion_count || 0) +
    //         (interaction.intrusion_cause ? 1 : 0);

    //       const toolReliability =
    //         toolTotal > 0
    //           ? ((toolTotal - toolIntrusions) / toolTotal) * 100
    //           : 0;
    //       const toolName = interaction.remote_name
    //       toolsObj[toolId] = {
    //         agent_name: `${toolName}`,
    //         agent_did: toolId,
    //         total_interactions: toolTotal,
    //         intrusion_count: toolIntrusions,
    //         agents_interacted: toolsSetForAgents[toolId]?.size || 0,
    //         reliability_factor: Number(toolReliability.toFixed(2)),
    //       };
    //     });


    //     setAgentsData(Object.values(agentsObj));
    //     setToolsData(Object.values(toolsObj));

    //   } catch (err) {
  
    //     //         setAgentsData({});
    //     // setToolsData({});
    //     // setInteractionsData();
    //   } finally {
    //     setIsLoadingList(false);
    //   }
    // };


    
  //   fetchTools();
  // }, [interactions]);

  useEffect(() => {
  fetchAgents(setAgentsData, setIsLoadingList);
  fetchTools(setToolsData, setIsLoadingList);
}, []);

  useEffect(() => {
  }, [metricsData]);

  // ---------------- SEARCH ----------------

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) onSearchByEmail(searchValue.trim());
  };

  return (
    <div className="main-dashboard">
      {/* SEARCH */}
      <form className="main-search-form" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Search agents by email"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="main-search-input"
        />
      </form>

      {/* METRICS */}
      <section className="hub">
        <div className="hub-grid">
          <a className="card center card-link">
            <div className="card-body">
              <h3>Secured Agents</h3>
              <p>Number of agents secured with AgentDNA</p>
              <h2>{metricsData.agentsSecured}</h2>
            </div>
          </a>

          <a className="card center card-link">
            <div className="card-body">
              <h3>Intrusions Detected</h3>
              <p>Total number of intrusion attempts detected</p>
              <h2>{metricsData.globalIntrusions}</h2>
            </div>
          </a>

          <a className="card center card-link">
            <div className="card-body">
              <h3>Total Interactions</h3>
              <p>Total number of interactions between agents</p>
              <h2>{metricsData.globalTotalInteractions}</h2>
            </div>
          </a>

          <a className="card center card-link">
            <div className="card-body">
              <h3>Total Tools</h3>
              <p>Total number of Tools agents </p>
              <h2>{metricsData.globalTotalInteractions}</h2>
            </div>
          </a>
        </div>
      </section>

      {/* TABS */}
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
      </div>

      {/* LIST of Interactions */}
      {activeTab === "interactions" &&
        (isLoadingList ? (
          <div className="loading-text">Loading Interactions</div>
        ) : interactionsData.length === 0 ? (
          <div className="empty-text">No Interactions found</div>
        ) : (
          interactionsData.map((interaction, index) => (
            <InteractionsListItem
              key={index}
              interaction={interaction}
              index={index}
            />
          ))
        ))}

      {/* LIST of Agents */}
      {activeTab === "agents" &&
        (isLoadingList ? (
          <div className="loading-text">Loading agents…</div>
        ) : agentsData.length === 0 ? (
          <div className="empty-text">No agents found</div>
        ) : (
          agentsData.map((agent, index) => (
            <AgentListItem
              key={index}
              agent={agent}
              index={index}
              onClick={() => onOpenAgent(agent.agent_did)}
            />
          ))
        ))}

      {/* LIST of Tools */}
      {activeTab === "tools" &&
        (isLoadingList ? (
          <div className="loading-text">Loading Tools</div>
        ) : toolsData.length === 0 ? (
          <div className="empty-text">No Tools found</div>
        ) : (
          toolsData.map((tool, index) => (
            <ToolListItem
              key={index}
              agent={tool}
              index={index}
              onClick={() => onOpenTool(tool.agent_did)}
            />
          ))
        ))}
    </div>
  );
};

export default MainDashboard;
