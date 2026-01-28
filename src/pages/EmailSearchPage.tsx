import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmailSearchPageComponent from "../components/EmailSearchPage";
import type { NFTRecord } from "../types";
import { parseNFTData } from "../components/AgentInfoDashboard";

const EmailSearchPage = () => {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();

  const [emailSearchList, setEmailSearchList] = useState<NFTRecord[]>([]);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [enrichedAgents, setEnrichedAgents] = useState<NFTRecord[]>([]);
  

  const [metricsData, setMetricsData] = useState({
    agentsInteracted: 0,
    totalInteractions: 0,
    intrusions: 0,
    globalAgentsInteracted: 0,
  });

  // ---------------- FETCH EMAIL NFTS ----------------

  useEffect(() => {
    if (!email) {
      navigate("/");
      return;
    }

    const fetchEmailResults = async () => {
      const decodedEmail = decodeURIComponent(email);
      setIsLoadingEmail(true);
      setEmailSearchList([]);

      try {
        const res = await fetch(
          `https://chain-connector-1.rubix.net/get-nft-by-email?email=${encodeURIComponent(
            decodedEmail
          )}`
        );

        const data = await res.json();

        if (Array.isArray(data.nfts)) {
          const filtered = data.nfts.filter(
            (n: any) => n?.nft_id && n.nft_id.trim() !== ""
          );

          const formatted: NFTRecord[] = filtered.map((n: any) => ({
            id: n.nft_id.trim(),
            owner_did: "",
            nft_value: 0,
            nft_metadata: "",
            nft_file_name: "",
            nft_name: n.nft_name?.trim() || undefined,
            intrusion_count: 0,
            total_interactions: 0,
          }));

          setEmailSearchList(formatted);
        } else {
          setEmailSearchList([]);
        }
      } catch (err) {
        console.error("Email search error:", err);
        setEmailSearchList([]);
      }

      setIsLoadingEmail(false);
    };

    fetchEmailResults();
  }, [email, navigate]);

  // ---------------- CHAIN METRICS ----------------

  async function fetchChain(id: string) {
    try {
      const res = await fetch(
        `https://chain-connector-1.rubix.net/api/get-nft-token-chain-data?nft=${id}`
      );
      const data = await res.json();
      return data.NFTDataReply || [];
    } catch (err) {
      console.error("Chain error:", err);
      return [];
    }
  }

 async function computeMetrics(agents: NFTRecord[]) {
  if (!agents.length) {
    setMetricsData({
      agentsInteracted: 0,
      totalInteractions: 0,
      intrusions: 0,
      globalAgentsInteracted: 0,
    });
    return;
  }

  let globalTotalInteractions = 0;
  let globalIntrusions = 0;
  let globalAgentsInteractedSet = new Set<string>();

  const updatedAgents = await Promise.all(
    agents.map(async (agent) => {
       const interactedAgentsSet = new Set<string>();

      const chain = await fetchChain(agent.id);
      const validBlocks = chain.filter((b: any) => b.BlockNo !== 0);

      let agentInteractions = validBlocks.length;
      let agentIntrusions = 0;
      let agents_interacted = new Set<string>();
      let agents_interacted_count = 0;

      validBlocks.forEach((block: any) => {
        try {
          const parsed = JSON.parse(block.NFTData);
          const parsedData = parseNFTData(block.NFTData);
          
          console.log("test11:", parsed);
          const bad =
            parsed?.verification?.status === "failed" ||
            (parsed?.verification?.trust_issues?.length ?? 0) > 0 ||
            (parsed?.responses?.[0]?.envelope?.host_trust_issues?.length ?? 0) >
              0;
          if (bad) agentIntrusions++;
           if (parsedData.interactedAgent) {
              interactedAgentsSet.add(parsedData.interactedAgent);
              globalAgentsInteractedSet.add(parsedData.interactedAgent);
            }
         
        } catch {}
      });
      console.log("Agent ID:", agent.id, "Intrusions:", agentIntrusions);
      globalTotalInteractions += agentInteractions;
      globalIntrusions += agentIntrusions;
  
      return {
        ...agent,
        total_interactions: agentInteractions,
        intrusion_count: agentIntrusions,
        agents_interacted: interactedAgentsSet.size,
        chainData: chain,
      };
    })
  );

  // Update agent list with enriched data

  console.log("test", updatedAgents)
  setEnrichedAgents(updatedAgents);

  // Update dashboard metrics
  setMetricsData({
    agentsInteracted: updatedAgents.length,
    totalInteractions: globalTotalInteractions,
    intrusions: globalIntrusions,
    globalAgentsInteracted: globalAgentsInteractedSet.size,

  });
}


  useEffect(() => {
    computeMetrics(emailSearchList);
  }, [emailSearchList]);

  // ---------------- NAV HANDLERS ----------------

  const handleBack = () => {
    navigate("/");
  };

  const handleOpenNFT = (id: string) => {
    navigate(`/agent/${encodeURIComponent(id)}`, {
      state: { fromEmailSearch: true, email },
    });
  };

  if (!email) return null;

  // ---------------- UI ----------------

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

      <EmailSearchPageComponent
        email={decodeURIComponent(email)}
        onBack={handleBack}
        results={enrichedAgents}
        loading={isLoadingEmail}
        onOpenNFT={handleOpenNFT}
      />
    </>
  );
};

export default EmailSearchPage;
