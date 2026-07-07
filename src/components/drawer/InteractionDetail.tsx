import { useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import { EntityCell } from "../EntityCell";
import { DrawerSection } from "./DrawerSection";
import { useDrawer } from "../../context/DrawerContext";
import { useResolveName } from "../../context/DirectoryContext";
function truncateIntentId(id: string): string {
  if (id.length <= 11) return id;
  return `${id.slice(0, 6)}…${id.slice(-5)}`;
}
import { fmtRuntime, timeAgo } from "../../lib/format";
import type { Interaction } from "../../types";

interface Props {
  interaction: Interaction;
}

export function InteractionDetail({ interaction: i }: Props) {
  const { closeDrawer } = useDrawer();
  const navigate = useNavigate();
  const resolve = useResolveName();

  const openIntent = () => {
    if (!i.intent?.id) return;
    closeDrawer();
    navigate(`/intents/${i.intent.id}`);
  };

  /**
   * Pick the best display name we have:
   *   1. Directory match (agent / tool / user with kind set)
   *   2. Backend-supplied fromName / toName on the interaction
   *   3. Shortened DID fallback baked into resolve()
   */
  const pickName = (did: string, apiName: string | undefined) => {
    const hit = resolve(did);
    if (hit.kind && hit.name) return { name: hit.name, kind: hit.kind };
    if (apiName && apiName.trim() && !apiName.includes("…")) return { name: apiName.trim(), kind: hit.kind };
    return { name: hit.name || did, kind: hit.kind };
  };

  const initiator = pickName(i.initiator.id, i.initiator.name);
  const target = pickName(i.target.id, i.target.name);
  const targetKind = target.kind || i.targetType;
  return (
    <>
      <div className="drawer-head">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: i.threat
              ? "linear-gradient(135deg, rgba(220, 38, 38,0.22), rgba(217, 119, 6,0.06))"
              : "linear-gradient(135deg, rgba(37, 99, 235,0.18), rgba(14, 165, 233,0.06))",
            display: "grid",
            placeItems: "center",
            border: "1px solid var(--line-strong)",
            color: i.threat ? "var(--threat)" : "var(--accent)",
          }}
        >
          <Icon name={i.threat ? "shield" : "activity"} size={20} />
        </div>
        <div>
          <h2>Interaction</h2>
          <div className="meta">
            <span style={{ fontFamily: "var(--font-mono)" }}>{i.id}</span>
            {i.threat && (
              <span className="chip threat">
                <span className="dot-status threat" /> threat
              </span>
            )}
          </div>
        </div>
        <button className="close" onClick={closeDrawer}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="drawer-body">
        <DrawerSection title="Flow">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Initiator
              </div>
              <EntityCell name={initiator.name} sub={i.initiator.id} paletteIx={initiator.name.charCodeAt(0)} />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--accent)",
                paddingLeft: 12,
              }}
            >
              <Icon name="arrowRight" size={16} style={{ transform: "rotate(90deg)" }} />
              <span style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                {fmtRuntime(i.runtime)}
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Target · {targetKind === "tool" ? "app" : targetKind}
              </div>
              <EntityCell name={target.name} sub={i.target.id} paletteIx={(target.name.charCodeAt(2) || 0)} />
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Metadata">
          <div className="kv">
            <div className="k">Interaction ID</div>
            <div className="v">{i.id}</div>
            <div className="k">Time</div>
            <div className="v">{timeAgo(i.created)}</div>
            <div className="k">Runtime</div>
            <div className="v">{fmtRuntime(i.runtime)}</div>
            {i.blockType && (
              <>
                <div className="k">Block type</div>
                <div className="v" style={{ fontFamily: "var(--font-mono)" }}>{i.blockType}</div>
              </>
            )}
            <div className="k">Threat detected</div>
            <div className="v" style={{ color: i.threat ? "var(--threat)" : "var(--safe)" }}>
              {i.threat ? "true" : "false"}
            </div>
            <div className="k">Intent ID</div>
            <div className="v">
              {i.intent?.id ? (
                <button
                  type="button"
                  onClick={openIntent}
                  title="Open intent"
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    color: "var(--accent)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "inherit",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  {truncateIntentId(i.intent.id)}
                </button>
              ) : (
                "—"
              )}
            </div>
            <div className="k">Intent</div>
            <div className="v" style={{ fontFamily: "var(--font-body)" }}>{i.intent.name}</div>
          </div>
        </DrawerSection>

      </div>
    </>
  );
}
