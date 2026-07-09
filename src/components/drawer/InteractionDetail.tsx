import { useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import { EntityCell } from "../EntityCell";
import { DrawerSection } from "./DrawerSection";
import { useDrawer } from "../../context/DrawerContext";
import { useResolveName } from "../../context/DirectoryContext";
import { useIntentLabel } from "../../context/IntentNumbersContext";
import { fmtRuntime, timeAgo } from "../../lib/format";
import type { Interaction } from "../../types";

interface Props {
  interaction: Interaction;
}

export function InteractionDetail({ interaction: i }: Props) {
  const { closeDrawer } = useDrawer();
  const navigate = useNavigate();
  const resolve = useResolveName();
  const intentLabel = useIntentLabel();

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
            <span style={{ fontFamily: "var(--font-mono)" }}>{truncateId(i.id)}</span>
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
              <EntityCell name={initiator.name} paletteIx={initiator.name.charCodeAt(0)} />
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
              {/* <span style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                {fmtRuntime(i.runtime)}
              </span> */}
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
              <EntityCell name={target.name} paletteIx={(target.name.charCodeAt(2) || 0)} />
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Metadata">
          <div className="kv">
            <div className="k">Interaction ID</div>
            <div className="v" style={{ fontFamily: "var(--font-mono)" }}>{truncateId(i.id)}</div>
            <div className="k">Time</div>
            <div className="v">{timeAgo(i.created)}</div>
       
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
                  {truncateId(intentLabel(i.intent.id))}
                </button>
              ) : (
                "—"
              )}
            </div>
            <div className="v" style={{ fontFamily: "var(--font-body)" }}>{i.intent.name}</div>
          </div>
        </DrawerSection>

        <DrawerSection title="Audit trail">
          <div className="timeline">
            <div className="tl-item">
              <div className="dot" />
              <div className="line" />
              <div className="body">
                <div className="nm">Identity authorized</div>
                <div className="desc">Signature {i.initiator.id.slice(-6)} matched against registered key</div>
              </div>
            </div>

            <div className="tl-item">
              <div className="dot" />
              <div className="line" />
              <div className="body">
                <div className="nm">Access verified</div>
                <div className="desc">Policies checked and verified for {i.target.name || i.target.id}</div>
              </div>
            </div>

            {i.threat && (
              <div className="tl-item threat">
                <div className="dot" />
                <div className="line" />
                <div className="body">
                  <div className="nm">Threat detected</div>
                  <div className="desc">Interaction flagged for review</div>
                </div>
              </div>
            )}

            <div className="tl-item">
              <div className="dot" />
              <div className="body">
                <div className="nm">Envelope sealed</div>
                <div className="desc">Interaction recorded, signed and committed</div>
              </div>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Raw data">
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
            <pre
              style={{
                margin: 0,
                padding: "12px",
                fontSize: 11.5,
                fontFamily: "var(--font-mono)",
                background: "#0f172a",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                lineHeight: 1.6,
                maxHeight: 360,
                overflowY: "auto",
              }}
              dangerouslySetInnerHTML={{ __html: colorizeJson(JSON.stringify({
                id: i.id,
                blockType: i.blockType,
                threat: i.threat,
                created: i.created,
                runtime: i.runtime,
                targetType: i.targetType,
                initiator: { id: i.initiator.id, name: i.initiator.name },
                target: { id: i.target.id, name: i.target.name },
                intent: { id: i.intent?.id, name: i.intent?.name },
              }, null, 2)) }}
            />
          </div>
        </DrawerSection>
      </div>
    </>
  );
}

function truncateId(id: string): string {
  if (!id || id.length <= 23) return id;
  return `${id.slice(0, 10)}...${id.slice(-10)}`;
}

function colorizeJson(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) return `<span style="color:#7dd3fc">${match}</span>`;
          return `<span style="color:#86efac">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span style="color:#fbbf24">${match}</span>`;
        if (/null/.test(match)) return `<span style="color:#f87171">${match}</span>`;
        return `<span style="color:#c084fc">${match}</span>`;
      },
    );
}
