import { useState, useEffect } from "react";
import type { NFTRecord } from "../types";
import "./MainDashboard.css";
import { parseNFTData } from "./AgentInfoDashboard";

interface MainDashboardProps {
  agents: NFTRecord[];
  onOpenAgent: (id: string) => void;
  onSearchByEmail: (email: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
}
const cards = [
  {
    title: "Secured Agents",
    description: "Number of agents secured with AgentDNA",
    data: 121,
  },
  {
    title: "Intrusions Detected",
    description: "Total number of intrusion attempts detected",
    data: 15,
  },
  {
    title: "Total Interactions ",
    description: "Total number of interactions between agents",
    data: 3421,
  },
];

const MainDashboard = ({
  agents,
  onOpenAgent,
  onSearchByEmail,
  searchValue,
  onSearchChange,
  isLoading,
}: MainDashboardProps) => {
  const [metricsData, setMetricsData] = useState({
    agentsSecured: 0,
    globalTotalInteractions: 0,
    globalIntrusions: 0,
  });
  const [enrichedAgents, setEnrichedAgents] = useState<NFTRecord[]>([]);

  // Fetch each NFT chain
  async function fetchChain(id: string) {
    try {
      const res = await fetch(
        `https://chain-connector-1.rubix.net/api/get-nft-token-chain-data?nft=${id}`,
      );
      const data = await res.json();
      return data.NFTDataReply || [];
    } catch (err) {
      console.error("Chain error:", err);
      return [];
    }
  }

  // Compute metrics (interactions + malicious blocks)
  async function computeMetrics() {
    if (!agents.length) return;

    let globalTotalInteractions = 0;
    let globalIntrusions = 0;

    const updatedAgents: NFTRecord[] = await Promise.all(
      agents.map(async (agent) => {
        const interactedAgentsSet = new Set<string>();

        const chain = await fetchChain(agent.id);

        const validBlocks = chain.filter((b: any) => b.BlockNo !== 0);

        const agentInteractions = validBlocks.length;
        let agentIntrusions = 0;

        validBlocks.forEach((block: any) => {
          try {
            const parsedData = parseNFTData(block.NFTData);

            const parsed = JSON.parse(block.NFTData);

            const bad =
              parsed?.verification?.status === "failed" ||
              (parsed?.verification?.trust_issues?.length ?? 0) > 0 ||
              (parsed?.responses?.[0]?.envelope?.host_trust_issues?.length ??
                0) > 0;

            if (bad) agentIntrusions++;
            if (parsedData.interactedAgent) {
              interactedAgentsSet.add(parsedData.interactedAgent);
            }

          } catch {}
        });

        // accumulate global numbers
        globalTotalInteractions += agentInteractions;
        globalIntrusions += agentIntrusions;

        // return enriched agent
        console.log("test22", agent.id, interactedAgentsSet.size);
        return {
          ...agent,
          total_interactions: agentInteractions,
          intrusion_count: agentIntrusions,
          agents_interacted: interactedAgentsSet.size,
          chainData: chain,
        };
      }),
    );

    // store enriched agents for UI
    setEnrichedAgents(updatedAgents);

    // store global metrics
    setMetricsData({
      agentsSecured: updatedAgents.length,
      globalTotalInteractions,
      globalIntrusions,
    });
  }

  useEffect(() => {
    computeMetrics();
  }, [agents]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) onSearchByEmail(searchValue.trim());
  };

  return (
    <div className="main-dashboard">
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
              <h3>{cards[0].title}</h3>
              <p>{cards[0].description}</p>
              <h2>{metricsData.agentsSecured}</h2>
            </div>
          </a>

          <a className="card center card-link">
            <div className="card-body">
              <h3>{cards[1].title}</h3>
              <p>{cards[1].description}</p>
              <h2>{metricsData.globalIntrusions}</h2>
            </div>
          </a>

          <a className="card center card-link">
            <div className="card-body">
              <h3>{cards[2].title}</h3>
              <p>{cards[2].description}</p>
              <h2>{metricsData.globalTotalInteractions}</h2>
            </div>
          </a>
        </div>
      </section>

      {/* AGENT LIST */}
      <div className="agents-list-section">
        <h2 className="agents-list-title">Secured Agents</h2>

        <div className="agents-table-container">
          {isLoading ? (
            <div className="loading-text">Loading agents…</div>
          ) : enrichedAgents.length === 0 ? (
            <div className="empty-text">No agents found</div>
          ) : (
            <div className="agents-list-wrapper">
              {enrichedAgents.map((agent, index) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  index={index}
                  onClick={() => {
                    console.log("CLICKED:", agent.id);
                    onOpenAgent(agent.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------------------- METRIC CARD ---------------------- */

const MetricCard = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) => (
  <div className="main-metric-card">
    <div className="main-metric-label">{label}</div>
    <div className="main-metric-value" style={{ color }}>
      {value.toLocaleString()}
    </div>
  </div>
);

/* ---------------------- AGENT LIST ITEM ---------------------- */

interface AgentListItemProps {
  agent: NFTRecord;
  index: number;
  onClick: () => void;
}

const AgentListItem = ({ agent, index, onClick }: AgentListItemProps) => {
  // Show nft_name if available, otherwise show id
  let displayName = agent.nft_name?.trim() || agent.id;

  return (
    <div
      className="agent-list-item"
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background =
          "linear-gradient(135deg, rgba(5, 15, 30, 0.9), rgba(10, 25, 45, 0.8))";
        e.currentTarget.style.borderColor = "rgba(69, 255, 232, 0.6)";
        e.currentTarget.style.transform = "translateY(-4px) translateX(4px)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(69, 255, 232, 0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background =
          "linear-gradient(135deg, rgba(5, 15, 30, 0.6), rgba(10, 25, 45, 0.5))";
        e.currentTarget.style.borderColor = "rgba(69, 255, 232, 0.25)";
        e.currentTarget.style.transform = "translateY(0) translateX(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="agent-item-number">{index + 1}</div>

      <div className="agent-item-info">
        <div className="agent-item-label">Agent Name</div>
        <div className="agent-item-id">{displayName}</div>
      </div>

      <div className="agent-item-info">
        <div className="agent-item-label">Interactions</div>
        <div className="agent-item-id">{agent.total_interactions}</div>
      </div>
      <div className="agent-item-info">
        <div className="agent-item-label">Intrusions</div>
        <div className="agent-item-id">{agent.intrusion_count}</div>
      </div>
        <div className="agent-item-info">
        <div className="agent-item-label">Agents Interacted</div>
        <div className="agent-item-id">{agent.agents_interacted}</div>
      </div>
    </div>
    
  );
};

export default MainDashboard;
