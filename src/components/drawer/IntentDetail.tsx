import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import { ScoreBar } from "../ScoreBar";
import { DrawerSection } from "./DrawerSection";
import { useDrawer } from "../../context/DrawerContext";
import { fetchInteractions } from "../../data/api";
import { fmtRuntime, timeAgo } from "../../lib/format";
import type { Intent, Interaction } from "../../types";

interface Props {
  intent: Intent;
}

export function IntentDetail({ intent: i }: Props) {
  const { closeDrawer } = useDrawer();
  const navigate = useNavigate();
  const [related, setRelated] = useState<Interaction[]>([]);

  const onViewFlow = () => {
    closeDrawer();
    navigate(`/graph/${i.id}`);
  };

  useEffect(() => {
    let cancelled = false;
    fetchInteractions().then((all) => {
      if (cancelled) return;
      setRelated(all.filter((x) => x.intent.id === i.id).slice(0, 8));
    });
    return () => {
      cancelled = true;
    };
  }, [i.id]);

  return (
    <>
      <div className="drawer-head">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(10, 34, 64,0.18), rgba(14, 165, 233,0.06))",
            display: "grid",
            placeItems: "center",
            color: "var(--accent-3)",
            border: "1px solid var(--line-strong)",
          }}
        >
          <Icon name="intents" size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{i.name}</h2>
          <div className="meta">
            <span>{i.id}</span>
            <span className="chip" style={{ fontSize: 10.5, padding: "2px 7px" }}>
              {fmtRuntime(i.runtime)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="btn primary"
            onClick={onViewFlow}
            style={{ padding: "6px 12px", fontSize: 12.5 }}
            title="Open this intent on the Flow page"
          >
            <Icon name="flow" size={14} />
            View Flow
          </button>
          <button className="close" onClick={closeDrawer}>
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
      <div className="drawer-body">
        <DrawerSection title="Overview">
          <div className="kv">
            <div className="k">Intent ID</div>
            <div className="v">{i.id}</div>
            <div className="k">Initiator</div>
            <div className="v" style={{ fontFamily: "var(--font-body)" }}>{i.initiator.name}</div>
            <div className="k">Started</div>
            <div className="v">{timeAgo(i.started)}</div>
            <div className="k">Runtime</div>
            <div className="v">{fmtRuntime(i.runtime)}</div>
            <div className="k">Agents touched</div>
            <div className="v">{i.agentsInteracted}</div>
            <div className="k">Apps touched</div>
            <div className="v">{i.toolsInteracted}</div>
            <div className="k">Threats</div>
            <div className="v" style={{ color: i.threats > 0 ? "var(--threat)" : "var(--safe)" }}>{i.threats}</div>
          </div>
        </DrawerSection>

        <DrawerSection title="Reliability">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {i.score}
            </div>
            <div style={{ flex: 1 }}>
              <ScoreBar value={i.score} />
              <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8 }}>
                Based on successful sub-task completion and policy adherence.
              </div>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title={`Trace · ${related.length} interactions`}>
          <div className="timeline">
            {related.map((ixn) => (
              <div key={ixn.id} className={`tl-item ${ixn.threat ? "threat" : ""}`}>
                <div className="dot" />
                <div className="line" />
                <div className="body">
                  <div className="nm">
                    {ixn.initiator.name} <span style={{ color: "var(--fg-muted)" }}>→</span> {ixn.target.name}
                  </div>
                  <div className="desc">{ixn.id} · {fmtRuntime(ixn.runtime)}</div>
                </div>
                <div className="ts">{timeAgo(ixn.created)}</div>
              </div>
            ))}
            {related.length === 0 && (
              <div style={{ color: "var(--fg-muted)", fontSize: 13 }}>No traced interactions yet.</div>
            )}
          </div>
        </DrawerSection>
      </div>
    </>
  );
}
