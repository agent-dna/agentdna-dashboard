import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchResults } from "../data/api";
import { timeAgo } from "../lib/format";

interface Props {
  query: string;
  results: SearchResults | null;
  loading: boolean;
  onClose: () => void;
}

export function SearchDropdown({ query, results, loading, onClose }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [onClose]);

  const go = (path: string) => { navigate(path); onClose(); };

  const hasAgents  = (results?.agents.length  ?? 0) > 0;
  const hasApps    = (results?.apps.length    ?? 0) > 0;
  const hasIntents = (results?.intents.length ?? 0) > 0;
  const empty = results && !hasAgents && !hasApps && !hasIntents;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(10,34,64,0.13)",
        overflow: "hidden",
        maxHeight: 420,
        overflowY: "auto",
      }}
    >
      {loading && (
        <div style={{ padding: "14px 16px", fontSize: 13, color: "#64748b" }}>Searching…</div>
      )}

      {!loading && empty && (
        <div style={{ padding: "14px 16px", fontSize: 13, color: "#64748b" }}>
          No results for <strong>"{query}"</strong>
        </div>
      )}

      {!loading && hasAgents && (
        <Section label="Agents">
          {results!.agents.map((a) => (
            <ResultRow
              key={a.did}
              icon="A"
              primary={a.name || a.did}
              secondary={a.did}
              color="#2563eb"
              onClick={() => go(`/agents/${a.did}`)}
            />
          ))}
        </Section>
      )}

      {!loading && hasApps && (
        <Section label="Apps">
          {results!.apps.map((a) => (
            <ResultRow
              key={a.did}
              icon="P"
              primary={a.name || a.did}
              secondary={a.did}
              color="#0ea5e9"
              onClick={() => go(`/agents?tab=apps`)}
            />
          ))}
        </Section>
      )}

      {!loading && hasIntents && (
        <Section label="Intents">
          {results!.intents.map((i) => (
            <ResultRow
              key={i.intentID}
              icon="I"
              primary={truncateId(i.intentID)}
              secondary={`${i.status} · ${timeAgo(new Date(i.startedAt).getTime() / 60000)}${i.threatDetected ? " · ⚠ threat" : ""}`}
              color={i.threatDetected ? "#dc2626" : "#16a34a"}
              onClick={() => go(`/intents/${i.intentID}`)}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        padding: "8px 16px 4px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#94a3b8",
        borderTop: "1px solid #f1f5f9",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ icon, primary, secondary, color, onClick }: {
  icon: string; primary: string; secondary: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 16px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{
        width: 28, height: 28, borderRadius: 7, background: color + "18",
        color, fontWeight: 700, fontSize: 11, display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{primary}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>{secondary}</div>
      </span>
    </button>
  );
}

function truncateId(id: string): string {
  if (!id || id.length <= 20) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
}
