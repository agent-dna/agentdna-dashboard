import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import AgentInfoDashboard from "../components/AgentInfoDashboard";
import { BACKEND_URL } from "../App";


const AgentProfilePage = () => {
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
    toolsInteracted: 0,
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
          `${BACKEND_URL}/interactions/agent/${id}`,
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
          console.log("test7", interaction)
          if (interaction.intrusion_cause) {

            totalIntrusions += 1;
          }

         interactedAgentsSet.add(interaction.host_did);

        }); 
        
        console.log("test5", totalIntrusions, totalInteractions)
        let factor = (( totalInteractions - totalIntrusions) / totalInteractions ) * 100 ;

        setMetricsData({
          toolsInteracted: interactedAgentsSet.size,
          totalInteractions,
          intrusions: totalIntrusions,
          reliabilityFactor: factor,
        });

        setSelectedAgentName(interactionsData[0].host_name || "Unknown Agent");
        setSelectedAgentDID(interactionsData[0].host_did || null);
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

  // const handleOpenAgent = (id: string) => {
  //   navigate(`/agent/${encodeURIComponent(id)}`);
  // };

   const handleOpenTool = (id: string) => {
    navigate(`/tool/${encodeURIComponent(id)}`);
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
        <h1 className="hero-title">Agent Profile </h1>
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
                <h2>{metricsData.toolsInteracted}</h2>
              </div>
            </a>
          </div>
        </section>
      </section>
      <AgentInfoDashboard
        selectedAgentName={selectedAgentName}
        selectedAgentDID={selectedAgentDID}
        onOpenTool={handleOpenTool}
        onBackToDashboard={handleBackToDashboard}
        onSearchAgent={handleSearchAgent}
        searchValue={query}
        onSearchChange={setQuery}
        isLoading={isLoadingData}
      />
    </>
  );
};

export default AgentProfilePage;
