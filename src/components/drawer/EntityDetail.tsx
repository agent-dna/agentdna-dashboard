import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { ScoreBar } from "../ScoreBar";
import { DrawerSection } from "./DrawerSection";
import { useDrawer } from "../../context/DrawerContext";
import { fetchInteractions } from "../../data/api";
import { fmtRuntime, initials, timeAgo } from "../../lib/format";
import type { Agent, Tool, Interaction } from "../../types";

interface EntityDetailProps {
  entity: Agent | Tool;
  kind: "agent" | "tool";
}

export function EntityDetail({ entity, kind }: EntityDetailProps) {
  const { closeDrawer } = useDrawer();
  const [related, setRelated] = useState<Interaction[]>([]);
  const isAgent = kind === "agent";

  useEffect(() => {
    let cancelled = false;
    fetchInteractions().then((all) => {
      if (cancelled) return;
      setRelated(all.filter((i) => i.initiator.id === entity.id || i.target.id === entity.id).slice(0, 6));
    });
    return () => {
      cancelled = true;
    };
  }, [entity.id]);

  const agent = entity as Agent;
  const tool = entity as Tool;
  const kindLabel = kind === "tool" ? "app" : "agent";

  return (
    <>
      <div className="drawer-head">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(37, 99, 235,0.18), rgba(14, 165, 233,0.06))",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--accent)",
            border: "1px solid var(--line-strong)",
          }}
        >
          {initials(entity.name)}
        </div>
        <div>
          <h2>{entity.name}</h2>
          <div className="meta">
            <span className={`chip ${isAgent ? "info" : "purple"}`} style={{ fontSize: 10.5, padding: "2px 7px" }}>
              {kindLabel}
            </span>
            <span>{entity.id}</span>
          </div>
        </div>
        <button className="close" onClick={closeDrawer}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="drawer-body">
        <DrawerSection title="Identity">
          <div className="kv">
            <div className="k">ID</div>
            <div className="v">{entity.id}</div>
            <div className="k">Type</div>
            <div className="v">{kindLabel}</div>
            {isAgent && (
              <>
                <div className="k">Owner</div>
                <div className="v">{agent.owner}</div>
                <div className="k">Environment</div>
                <div className="v">{agent.env}</div>
              </>
            )}
            {!isAgent && (
              <>
                <div className="k">Provider</div>
                <div className="v">{tool.provider}</div>
                <div className="k">Scope</div>
                <div className="v">{tool.scope}</div>
              </>
            )}
            <div className="k">Created</div>
            <div className="v">{timeAgo(entity.created)}</div>
          </div>
        </DrawerSection>

        <DrawerSection title="Reliability score">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {entity.score}
            </div>
            <div style={{ flex: 1 }}>
              <ScoreBar value={entity.score} />
              <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8 }}>
                Composite of behavioral consistency, policy compliance, and threat signal density over the last 30 days.
              </div>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Activity">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Interactions
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500 }}>
                {entity.interactions.toLocaleString()}
              </div>
            </div>
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Threats
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  fontWeight: 500,
                  color: entity.threats > 0 ? "var(--threat)" : "var(--fg)",
                }}
              >
                {entity.threats}
              </div>
            </div>
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {isAgent ? "Apps" : "Agents"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500 }}>{entity.connected}</div>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Recent interactions">
          <div className="timeline">
            {related.map((ixn) => (
              <div key={ixn.id} className={`tl-item ${ixn.threat ? "threat" : ""}`}>
                <div className="dot" />
                <div className="line" />
                <div className="body">
                  <div className="nm">
                    {ixn.initiator.id === entity.id ? `→ ${ixn.target.name}` : `← from ${ixn.initiator.name}`}
                  </div>
                  <div className="desc">
                    {ixn.intent.name} · {fmtRuntime(ixn.runtime)}
                  </div>
                </div>
                <div className="ts">{timeAgo(ixn.created)}</div>
              </div>
            ))}
            {related.length === 0 && <div style={{ color: "var(--fg-muted)", fontSize: 13 }}>No recent activity.</div>}
          </div>
        </DrawerSection>
      </div>
    </>
  );
}
