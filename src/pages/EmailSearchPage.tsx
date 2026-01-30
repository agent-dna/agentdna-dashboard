import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmailPage from "../components/EmailSearchPage";
import { BACKEND_URL } from "../App";


const EmailSearchPage = () => {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();

  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
 
  const [metricsData, setMetricsData] = useState({
    agentsInteracted: 0,
    totalInteractions: 0,
    intrusions: 0,
    globalAgentsInteracted: 0,
  });

  useEffect(() => {
  const fetchMetrics = async () => {
      if (!email) return;

      setIsLoadingEmail(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/metrics/${encodeURIComponent(email)}`,
        );
        let json = await res.json();
        if (!json.status) {

        }
        const data = json.data;

        setMetricsData({
          agentsInteracted: data.total_agents || 0,
          totalInteractions: data.total_interactions || 0,
          intrusions: data.total_intrusions || 0,
          globalAgentsInteracted: data.interacted_tools || 0,
        });

      } catch {
        setMetricsData({
          agentsInteracted: 0,
          totalInteractions: 0,
          intrusions: 0,
          globalAgentsInteracted: 0,
        });
      } finally {
        setIsLoadingEmail(false);
      }

  } 
 
    fetchMetrics();
}, [email]);


  const handleBack = () => {
    navigate("/");
  };

  const handleOpenNFT = (id: string) => {
    navigate(`/agent/${encodeURIComponent(id)}`, {
      state: { fromEmailSearch: true, email },
    });
  };

  if (!email) return null;

  return (
    <>
      <section className="hero">
        <h1 className="hero-title">Agents Under</h1>
        <h2 className="hero-title-h2">{decodeURIComponent(email)}</h2>
        <p className="hero-sub">
          Monitor and manage your autonomous agents securely.
        </p>

        <section className="hub">
          <div className="hub-grid">
            <a className="card center card-link">
              <div className="card-body">
                <h3>Agents Deployed</h3>
                <p>Total number of agents deployed</p>
                <h2>{metricsData.agentsInteracted}</h2>
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
                <h3>Total Agents Interacted </h3>
                <p>Total number of agents interacted with</p>
                <h2>{metricsData.globalAgentsInteracted}</h2>
              </div>
            </a>
          </div>
        </section>
      </section>

      <EmailPage
        email={decodeURIComponent(email)}
        onBack={handleBack}
        loading={isLoadingEmail}
        onOpenAgent={handleOpenNFT}
      />
    </>
  );
};

export default EmailSearchPage;