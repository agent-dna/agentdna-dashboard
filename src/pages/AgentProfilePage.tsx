import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Bot, Shield, Zap, Activity, Network } from "lucide-react";
import AgentInfoDashboard from "../components/AgentInfoDashboard";
import { BACKEND_URL } from "../App";

const AgentProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null);
  const [selectedAgentDID, setSelectedAgentDID] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [metricsData, setMetricsData] = useState({
    toolsInteracted: 0,
    totalInteractions: 0,
    intrusions: 0,
    reliabilityFactor: 0,
  });

  type AgentLookup = Record<string, { name: string; did: string }>;

  const fetchAgentLookup = async (): Promise<AgentLookup> => {
    const res = await fetch(`${BACKEND_URL}/agents`);
    const json = await res.json();
    if (!json.status || !Array.isArray(json.data)) return {};
    const lookup: AgentLookup = {};
    json.data.forEach((agent: any) => {
      lookup[agent.agent_did] = { name: agent.agent_name, did: agent.agent_did };
    });
    return lookup;
  };

  useEffect(() => {
    const fetchAgentDetails = async () => {
      if (!id) return;
      const agentLookup = await fetchAgentLookup();
      const agentMeta = agentLookup[id];
      setSelectedAgentName(agentMeta?.name || "Unknown Agent");
      setSelectedAgentDID(agentMeta?.did || id);
      setIsLoadingData(true);
      try {
        const res = await fetch(`${BACKEND_URL}/interactions/agent/${id}`);
        const json = await res.json();
        if (!json.status) return;
        const data = json.data;
        let totalInteractions = 0;
        let totalIntrusions = 0;
        const interactedSet = new Set<string>();
        data.forEach((interaction: any) => {
          totalInteractions += 1;
          if (interaction.intrusion_cause) totalIntrusions += 1;
          interactedSet.add(interaction.host_did);
        });
        const factor = ((totalInteractions - totalIntrusions) / totalInteractions) * 100;
        setMetricsData({
          toolsInteracted: interactedSet.size,
          totalInteractions,
          intrusions: totalIntrusions,
          reliabilityFactor: factor,
        });
      } catch {
        setSelectedAgentName("Unknown Agent");
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchAgentDetails();
  }, [id]);

  const handleBackToDashboard = () => {
    const state = location.state as { fromEmailSearch?: boolean; email?: string } | null;
    if (state?.fromEmailSearch && state?.email) {
      navigate(`/search/${encodeURIComponent(state.email)}`);
    } else {
      navigate("/");
    }
  };

  const handleOpenTool = (toolId: string) => navigate(`/tool/${encodeURIComponent(toolId)}`);
  const handleSearchAgent = (agentId: string) => navigate(`/agent/${encodeURIComponent(agentId)}`);

  if (!id) return null;

  const metrics = [
    {
      icon: <Activity size={20} className="text-primary-fixed" />,
      label: "Reliability Factor",
      value: Number.isFinite(metricsData.reliabilityFactor)
        ? `${metricsData.reliabilityFactor.toFixed(1)}%`
        : "—",
      accent: "text-primary-fixed",
    },
    {
      icon: <Shield size={20} className="text-error" />,
      label: "Intrusions Detected",
      value: metricsData.intrusions,
      accent: "text-error",
    },
    {
      icon: <Zap size={20} className="text-on-surface-variant" />,
      label: "Total Interactions",
      value: metricsData.totalInteractions,
      accent: "text-on-surface",
    },
    {
      icon: <Network size={20} className="text-primary-fixed/70" />,
      label: "Tools Interacted",
      value: metricsData.toolsInteracted,
      accent: "text-on-surface",
    },
  ];

  return (
    <div className="page">
      {/* Back button */}
      <button
        onClick={handleBackToDashboard}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary-fixed transition-colors mb-8 font-headline text-sm uppercase tracking-wider"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      {/* Hero */}
      <div className="flex items-center gap-5 mb-10">
        <div className="w-14 h-14 rounded-xl bg-primary-fixed/10 border border-primary-fixed/20 flex items-center justify-center shrink-0">
          <Bot size={28} className="text-primary-fixed" />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface leading-tight">
            {isLoadingData ? "Loading…" : selectedAgentName}
          </h1>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="dashboard-card rounded-xl p-5 border border-outline-variant/30 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-on-surface-variant text-xs font-headline uppercase tracking-widest">
              {m.icon}
              {m.label}
            </div>
            <div className={`font-headline text-3xl font-bold ${m.accent}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabbed detail section */}
      <AgentInfoDashboard
        selectedAgentName={selectedAgentName}
        selectedAgentDID={selectedAgentDID}
        onOpenTool={handleOpenTool}
        onBackToDashboard={handleBackToDashboard}
        onSearchAgent={handleSearchAgent}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={isLoadingData}
      />
    </div>
  );
};

export default AgentProfilePage;
