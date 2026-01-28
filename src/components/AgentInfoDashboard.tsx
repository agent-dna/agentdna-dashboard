import { useEffect, useState } from "react";
import type { NFTChainData, MetricCard } from "../types";
import "./AgentInfoDashboard.css";

interface AgentInfoDashboardProps {
  selectedAgentName?: string | null;
  onBackToDashboard: () => void;
  onSearchAgent: (id: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  chainData: NFTChainData[] | null;
  isLoading: boolean;
}


/* -----------------------------------------
   Helper: Parse NFTData JSON Safely
------------------------------------------ */
export function parseNFTData(nftRaw: string) {
  try {
    const json = JSON.parse(nftRaw);
    const {added, removed} = diffWords(json?.host?.envelope?.original_message ?? "Not provided", json?.responses?.[0]?.envelope?.original_message ?? "Not provided")

    return {
      original: json?.host?.envelope?.original_message ?? "Not provided",
      received:
        json?.responses?.[0]?.envelope?.original_message ??
        "Not provided",
      response:
        json?.responses?.[0]?.envelope?.response ??
        "Not provided",
      trustIssues: [
        ...(json?.responses?.[0]?.envelope?.host_trust_issues ?? []),
        ...(json?.verification?.trust_issues ?? []),
      ],
      status: json?.verification?.status ?? "ok",
      interactedAgent: json?.responses?.[0]?.agent ?? null,
      reason : {added , removed}
    };
  } catch {
    return {
      original: "Not provided",
      received: "Not provided",
      response: "Not provided",
      trustIssues: [],
      status: "ok",
      interactedAgent: null,
      reason : {added: [], removed: []}
    };
  }
}



function resolveAgentName(agentId: string | null) {
  if (!agentId) return "Unknown Agent";

  try {
    const stored = JSON.parse(localStorage.getItem("nftList") || "[]");
    const found = stored.find((n: any) => n.id === agentId);

    return (
      found?.nft_name ||
      found?.nft_file_name ||
      (() => {
        if (found?.nft_metadata) {
          const meta = JSON.parse(found.nft_metadata);
          return meta?.name;
        }
        return null;
      })() ||
      "Unknown Agent"
    );
  } catch {
    return "Unknown Agent";
  }
}


function diffWords(original: string, received: string) {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

  const origWords = normalize(original);
  const recvWords = normalize(received);

  const origSet = new Set(origWords);
  const recvSet = new Set(recvWords);

  const added = recvWords.filter((w) => !origSet.has(w));
  const removed = origWords.filter((w) => !recvSet.has(w));

  return { added, removed };
}

const AgentInfoDashboard = ({
  onBackToDashboard,
  chainData,
  isLoading,
}: AgentInfoDashboardProps) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleCard = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  /* -----------------------------------------
     Filter valid blocks
  ------------------------------------------ */
  const filtered = (chainData ?? []).filter((b) => b.BlockNo !== 0);
  const interactedAgentsSet = new Set<string>();
  let maliciousCount = 0;
  let genuineCount = 0;

  filtered.forEach((b) => {
    const parsed = parseNFTData(b.NFTData);
    const isMalicious =
      parsed.status === "failed" || parsed.trustIssues.length > 0;
    if (parsed.interactedAgent) {
      interactedAgentsSet.add(parsed.interactedAgent);
    }
    if (isMalicious) maliciousCount++;
    else genuineCount++;
  });

  const cards = [
  {
    title: "Total Interactions",
    description: "Number of agents running securely with AgentDNA",
    data: filtered.length.toString()  ,
  },
  {
    title: "Intrusions Detected",
    description: "Total number of intrusion attempts detected",
    data: maliciousCount.toString(),
  },
  {
    title: "Genuine Interactions",
    description: "Total number of interactions between agents",
    data: genuineCount.toString(),
  },
  {
    title: "Agents Interacted",
    description: "Total number of agents interacted with",
    data: interactedAgentsSet.size.toString(),
  },
];


  return (
    <div className="main-dashboard">

         {/* ---------------- METRICS ---------------- */}
         <section className="hub">
        <div className="hub-grid">
          <a className="card center card-link">
            <div className="card-body">
              <h3>{cards[0].title}</h3>
              <p>{cards[0].description}</p>
              <h2>{cards[0].data}</h2>
            </div>
          </a>

          <a className="card center card-link">
            <div className="card-body">
              <h3>{cards[1].title}</h3>
              <p>{cards[1].description}</p>
              <h2>{cards[1].data}</h2>
            </div>
          </a>

          <a className="card center card-link">
            <div className="card-body">
              <h3>{cards[2].title}</h3>
              <p>{cards[2].description}</p>
              <h2>{cards[2].data}</h2>
            </div>
          </a>
           <a className="card center card-link">
            <div className="card-body">
              <h3>{cards[3].title}</h3>
              <p>{cards[3].description}</p>
              <h2>{cards[3].data}</h2>
            </div>
          </a>
        </div>
      </section>


      {/* ---------------- INTERACTIONS ---------------- */}
      <div className="transaction-list-section">
        <h2 className="transaction-list-title">Interaction History</h2>

        {isLoading ? (
          <div className="center-muted">Loading interactions…</div>
        ) : filtered.length === 0 ? (
          <div className="center-muted">No interactions available.</div>
        ) : (
          <div className="transaction-queue">
            {filtered.map((data, index) => {
              const parsed = parseNFTData(data.NFTData);
              const isExpanded = expandedIndex === index;

              const isMalicious =
                parsed.status === "failed" ||
                parsed.trustIssues.length > 0;

              const cardClass = isMalicious
                ? "transaction-item intrusion-card"
                : "transaction-item genuine-card";

              return (
                <div
                  key={index}
                  className={`${cardClass} transaction-collapsible`}
                  onClick={() => toggleCard(index)}
                >
                  {/* -------- CLOSED VIEW -------- */}
                  {!isExpanded && (
                  <div className="transaction-header">
                    <div className="transaction-status">
                      {parsed.interactedAgent}

                    </div>

                    
                    <div className="transaction-time">
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(data.Epoch * 1000))}
                    </div>
                  </div>
                  )}

                  {/* -------- OPEN VIEW -------- */}
                  {isExpanded && (
                    <div className="transaction-expanded">
                      <div className="detail-row">
                        <span className="detail-label">Interacted Agent</span>
                        <span className="detail-value">
                          {parsed.interactedAgent}
                        </span>
                      </div>

                      {/* <div className="detail-row">
                        <span className="detail-label">Original Message</span>
                        <span className="detail-value">
                          {parsed.original}
                        </span>
                      </div> */}

                      {/* <div className="detail-row">
                        <span className="detail-label">Received Message</span>
                        <span className="detail-value">
                          {parsed.received}
                        </span>
                      </div> */}

                      {/* <div className="detail-row">
                        <span className="detail-label">Response</span>
                        <span className="detail-value">
                          {parsed.response}
                        </span>
                      </div> */}

                      <div className="detail-row">
                        <span className="detail-label">Injection</span>
                        <span className="detail-value">
                          {parsed.reason.added.length > 0 || parsed.reason.removed.length > 0 ? (
                            <div>
                              {parsed.reason.added.length > 0 && (
                                <div>
                                  <strong>Added : </strong> {parsed.reason.added.join(", ")}
                                </div>
                              )}
                              {parsed.reason.removed.length > 0 && (
                                <div>
                                  <strong>Removed </strong> {parsed.reason.removed.join(", ")}
                                </div>
                              )}
                            </div>
                          ) : (
                            "None"
                          )}
                        </span>
                      </div>

                      <div className="detail-row">
                        <span className="detail-label">Time</span>
                        <span className="detail-value">
                          {new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(data.Epoch * 1000))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentInfoDashboard;


