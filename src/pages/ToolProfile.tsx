import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ToolInfoDashboard from "../components/ToolInfoDashboard";
import { BACKEND_URL } from "../App";

const ToolProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(
    null,
  );
  const [selectedAgentDID, setSelectedAgentDID] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [metricsData, setMetricsData] = useState({
    agentsInteracted: 0,
    totalInteractions: 0,
    intrusions: 0,
    reliabilityFactor: 0,
  });

  useEffect(() => {
    const fetchAgentDetails = async () => {
      if (!id) return;

      setIsLoadingData(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/interactions/tool/${id}`,
        );

        const json = await res.json();

        if (!json.status) {
          return;
        }

        const interactionsData = json.data;

        let totalInteractions = 0;
        let totalIntrusions = 0;

        const interactedAgentsSet = new Set<string>();

        interactionsData.forEach((interaction : any ) => {
          totalInteractions += 1;

          if (interaction.intrusion_cause) {
            totalIntrusions += 1;
          }

          interactedAgentsSet.add(interaction.host_did);

          // track all unique agents involved in these interactions
        });

        let factor = (( totalInteractions - totalIntrusions) / totalInteractions ) * 100 ;

        setMetricsData({
          agentsInteracted: interactedAgentsSet.size,
          totalInteractions,
          intrusions: totalIntrusions,
          reliabilityFactor: factor,
        });

        setSelectedAgentName(interactionsData[0].remote_name || "Unknown Tool");
        setSelectedAgentDID(interactionsData[0].remote_did || null);
      } catch {
        setSelectedAgentName("Unknown Agent");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchAgentDetails();
  }, [id]);

  const handleBackToDashboard = () => {
    // Check if we came from email search page
    const state = location.state as {
      fromEmailSearch?: boolean;
      email?: string;
    } | null;
    if (state?.fromEmailSearch && state?.email) {
      navigate(`/search/${encodeURIComponent(state.email)}`);
    } else {
      navigate("/");
    }
  };

  const handleOpenAgent = (id: string) => {
    navigate(`/agent/${encodeURIComponent(id)}`);
  };

  const handleSearchAgent = (agentId: string) => {
    navigate(`/agent/${encodeURIComponent(agentId)}`);
  };

  if (!id) {
    return null;
  }

  return (
    <>
      <section className="hero">
        <h1 className="hero-title">Tool Profile </h1>
        <h2 className="hero-title-h2">{selectedAgentName}</h2>

        <section className="hub">
          <div className="hub-grid">
            <a className="card center card-link">
              <div className="card-body">
                <h3>Reliability Factor </h3>
                <p>How reliable is the agent</p>
                <h2>{metricsData.reliabilityFactor.toFixed(2)}</h2>
              </div>
            </a>

            <a className="card center card-link">
              <div className="card-body">
                <h3>Intrusions Detected</h3>
                <p>Total number of intrusion attempts detected</p>
                <h2>{metricsData.intrusions}</h2>
              </div>
            </a>

            <a className="card center card-link">
              <div className="card-body">
                <h3>Total Interactions</h3>
                <p>Total number of interactions between agents</p>
                <h2>{metricsData.totalInteractions}</h2>
              </div>
            </a>
            <a className="card center card-link">
              <div className="card-body">
                <h3>Total Tools Interacted </h3>
                <p>Total number of agents interacted with</p>
                <h2>{metricsData.agentsInteracted}</h2>
              </div>
            </a>
          </div>
        </section>
      </section>
      <ToolInfoDashboard
        selectedAgentName={selectedAgentName}
        selectedAgentDID={selectedAgentDID}
        onOpenAgent={handleOpenAgent}
        onBackToDashboard={handleBackToDashboard}
        onSearchAgent={handleSearchAgent}
        searchValue={query}
        onSearchChange={setQuery}
        isLoading={isLoadingData}
      />
    </>
  );
};

export default ToolProfilePage;
