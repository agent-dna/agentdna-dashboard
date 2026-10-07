import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../Icon";
import { DrawerSection } from "./DrawerSection";
import { useDrawer } from "../../context/DrawerContext";
import { useResolveName } from "../../context/DirectoryContext";
import { useIntentLabel } from "../../context/IntentNumbersContext";
import { useThreatByID } from "../../data/hooks";
import { timeAgo, interactionRawData, titleOrUnknown } from "../../lib/format";
import type { Interaction } from "../../types";

interface Props {
  interaction: Interaction;
}

export function InteractionDetail({ interaction: i }: Props) {
  const { closeDrawer } = useDrawer();
  const navigate = useNavigate();
  const resolve = useResolveName();
  const intentLabel = useIntentLabel();
  // Callers that already have the message (e.g. from /threats-list) pass it
  // straight through — skip the GET /threat-by-id round trip entirely so the
  // sidebar shows exactly what the threat table showed, with no extra fetch.
  const { data: threatDetail, loading: threatLoading, error: threatError } = useThreatByID(
    i.threat && !i.message ? i.threatID : undefined,
  );
  const threatMessage = i.message || threatDetail?.message;
  // What was sent in this hop: the envelope's own payload when we have it, else the endpoint's message.
  const rawPayload = (i.raw as { payload?: unknown } | undefined)?.payload;
  const payload = typeof rawPayload === "string" ? rawPayload : i.payload ?? i.message;

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
    // apiName is sometimes just the raw DID with no resolved name behind it
    // (backend had nothing to join) — truncate anything DID-length so it
    // doesn't overflow the drawer's fixed width.
    if (apiName && apiName.trim() && !apiName.includes("…")) return { name: truncateId(apiName.trim()), kind: hit.kind };
    return { name: truncateId(hit.name || did), kind: hit.kind };
  };

  const initiator = pickName(i.initiator.id, i.initiator.name);
  const target = pickName(i.target.id, i.target.name);
  const targetKind = target.kind || i.targetType;
  const isSelfInteraction = i.initiator.id === i.target.id;
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
          <div className={`ixd-route ${i.threat ? "blocked" : ""}`}>
            <Party role="From" name={initiator.name} kind={initiator.kind} did={i.initiator.id} />
            {isSelfInteraction ? (
              <div className="ixd-self">Sent to itself</div>
            ) : (
              <>
                <div className="ixd-rail">
                  <span className="line" aria-hidden />
                  {i.blockType && <span className="hop">{capitalize(i.blockType)}</span>}
                </div>
                <Party role="To" name={target.name} kind={targetKind} did={i.target.id} />
              </>
            )}
          </div>
        </DrawerSection>

        <DrawerSection title="Message">
          {payload ? <Payload text={payload} /> : <div className="ixd-none">No message was recorded for this interaction.</div>}
        </DrawerSection>

        <DrawerSection title="Metadata">
          <div className="kv">
            <div className="k">Interaction ID</div>
            <div className="v" style={{ fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 6 }}>
              {truncateId(i.id)}
              <CopyButton text={i.id} />
            </div>
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
            {i.threat && (i.threatID || i.message) && (
              <>
                {(threatLoading || threatDetail) && (
                  <>
                    <div className="k">Threat</div>
                    <div className="v">
                      {threatLoading ? (
                        <span style={{ color: "var(--fg-muted)" }}>Loading…</span>
                      ) : (
                        <span style={{ color: "var(--threat)" }}>
                          {titleOrUnknown(threatDetail!.title)}{" "}
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-muted)" }}>
                            (code {threatDetail!.threatCode})
                          </span>
                        </span>
                      )}
                    </div>
                  </>
                )}
                {threatMessage ? (
                  <>
                    <div className="k">Threat message</div>
                    <div className="v" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{threatMessage}</div>
                  </>
                ) : !threatLoading && (
                  <>
                    <div className="k">Threat message</div>
                    <div className="v" style={{ color: "var(--fg-muted)" }}>
                      {!i.threatID
                        ? "This interaction has no threatID from the endpoint it was loaded from."
                        : threatError
                        ? `Failed to load: ${threatError.message}`
                        : "No message returned for this threat."}
                    </div>
                  </>
                )}
              </>
            )}
            <div className="k">Intent ID</div>
            <div className="v" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i.intent?.id ? (
                <>
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
                  <CopyButton text={i.intent.id} />
                </>
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
                  <div className="desc">{threatMessage || "Interaction flagged for review"}</div>
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
              dangerouslySetInnerHTML={{ __html: colorizeJson(JSON.stringify(interactionRawData(i), null, 2)) }}
            />
          </div>
        </DrawerSection>
      </div>
    </>
  );
}

const KIND_LABEL: Record<string, string> = { agent: "Agent", tool: "App", user: "User" };
const KIND_ICON = { agent: "agents", tool: "apps", user: "user" } as const;

const capitalize = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : v);

/** One end of the hop: what it is, which end, and its name, with the DID on hover. */
function Party({ role, name, kind, did }: { role: string; name: string; kind?: string; did: string }) {
  const k = kind === "agent" || kind === "tool" || kind === "user" ? kind : undefined;
  return (
    <div className="ixd-party" title={did}>
      <span className={`ixd-av ${k ?? "unknown"}`} aria-hidden>
        {k ? <Icon name={KIND_ICON[k]} size={16} /> : (name.trim()[0] || "?").toUpperCase()}
      </span>
      <div className="ixd-party-text">
        <div className="ixd-role">
          {role}
          {k && <span className="ixd-kind">{KIND_LABEL[k]}</span>}
        </div>
        <div className="ixd-name">{name}</div>
      </div>
    </div>
  );
}

/** `tools/call` payloads name the tool they call; surface it so the request reads at a glance. */
function toolCallName(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { method?: unknown; params?: { name?: unknown } };
  return o.method === "tools/call" && typeof o.params?.name === "string" ? o.params.name : null;
}

/**
 * The hop's message. JSON can be read formatted or exactly as received (what Copy copies);
 * anything else is shown as received.
 */
function Payload({ text }: { text: string }) {
  const parsed = (() => {
    const t = text.trim();
    if (!(t.startsWith("{") || t.startsWith("["))) return undefined;
    try { return JSON.parse(t) as unknown; } catch { return undefined; }
  })();
  const isJson = parsed !== undefined;
  const [view, setView] = useState<"formatted" | "exact">("formatted");
  const tool = toolCallName(parsed);
  const shown = isJson && view === "formatted" ? JSON.stringify(parsed, null, 2) : text;
  return (
    <div className="ixd-msg">
      <div className="ixd-msg-head">
        <span className="ixd-msg-kind">
          {tool ? (
            <>Tool call <code>{tool}</code></>
          ) : isJson ? "JSON" : "Text"}
        </span>
        {isJson && (
          <div className="ixd-seg" role="group" aria-label="Message view">
            <button type="button" className={view === "formatted" ? "on" : ""} aria-pressed={view === "formatted"} onClick={() => setView("formatted")}>Formatted</button>
            <button type="button" className={view === "exact" ? "on" : ""} aria-pressed={view === "exact"} onClick={() => setView("exact")}>Exact</button>
          </div>
        )}
        <CopyButton text={text} />
      </div>
      {isJson && view === "formatted" ? (
        <pre className="ixd-msg-body json" dangerouslySetInnerHTML={{ __html: colorizeLight(shown) }} />
      ) : (
        <pre className="ixd-msg-body">{shown}</pre>
      )}
    </div>
  );
}

/** Light-theme JSON colouring: wraps tokens in classed spans, text unchanged (HTML-escaped). */
function colorizeLight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (m) => {
      if (/^"/.test(m)) return /:$/.test(m) ? `<span class="k">${m}</span>` : `<span class="s">${m}</span>`;
      if (/true|false/.test(m)) return `<span class="b">${m}</span>`;
      if (/null/.test(m)) return `<span class="n">${m}</span>`;
      return `<span class="num">${m}</span>`;
    });
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title={copied ? "Copied!" : "Copy to clipboard"}
      style={{
        background: "transparent",
        border: "none",
        padding: "2px 4px",
        cursor: "pointer",
        color: copied ? "var(--safe)" : "var(--fg-muted)",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 4,
        transition: "color 120ms",
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={13} />
    </button>
  );
}
