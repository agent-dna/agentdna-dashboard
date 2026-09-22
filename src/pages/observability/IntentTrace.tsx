import { useEffect } from "react";
import { Icon } from "../../components/Icon";
import { initials } from "../../lib/format";
import type { ObsGraph } from "./mockData";

/**
 * Left-to-right replay of one intent: the initiating user, then every agent hop in the order it ran,
 * with the action, latency and allow/block verdict on each connector.
 */
export function IntentTrace({
  g,
  intentId,
  statusColor,
  onClose,
}: {
  g: ObsGraph;
  intentId: string;
  statusColor: string;
  onClose: () => void;
}) {
  // Capture phase + preventDefault so the canvas's own Esc handler (step back a level) doesn't also fire.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const intent = g.intentById.get(intentId);
  if (!intent) return null;
  const user = g.userById.get(intent.userId);
  const hops = g.interactionsByIntent.get(intent.id) ?? [];
  const totalMs = hops.reduce((s, h) => s + h.latencyMs, 0);
  const blocked = hops.filter((h) => h.status === "blocked").length;

  return (
    <div className="obs-trace-backdrop" onClick={onClose}>
      <section className="obs-trace" role="dialog" aria-label={`Trace of ${intent.name}`} onClick={(e) => e.stopPropagation()}>
        <header className="obs-trace-head">
          <div>
            <div className="obs-trace-eyebrow">
              <span>{intent.id}</span>
              <span className="obs-trace-status" style={{ color: statusColor }}>
                <span className="dot" style={{ background: statusColor }} />
                {intent.status.replace("-", " ")}
              </span>
            </div>
            <h3 className="obs-trace-title">{intent.name}</h3>
            <div className="obs-trace-meta">
              Initiated by {user?.name ?? "unknown user"} · {hops.length} hop{hops.length === 1 ? "" : "s"} · {totalMs}ms total
              {blocked > 0 && <span className="obs-trace-meta-blocked"> · {blocked} blocked</span>}
            </div>
          </div>
          <button type="button" className="obs-help-close" onClick={onClose} aria-label="Close trace">
            <Icon name="close" size={14} />
          </button>
        </header>

        {hops.length === 0 ? (
          <div className="obs-trace-empty">No hops were recorded for this intent.</div>
        ) : (
          <div className="obs-trace-lane">
            <TraceActor kind="user" name={user?.name ?? "User"} role="USER" />
            <TraceLink label="initiated" />
            <TraceActor kind="agent" name={g.agentById.get(hops[0].fromAgentId)?.name ?? hops[0].fromAgentId} role="AGENT" />
            {hops.map((hop) => (
              <TraceHop
                key={hop.id}
                action={hop.action}
                detail={hop.detail}
                latencyMs={hop.latencyMs}
                blocked={hop.status === "blocked"}
                to={g.agentById.get(hop.toAgentId)?.name ?? hop.toAgentId}
              />
            ))}
          </div>
        )}

        <footer className="obs-trace-foot">Hops are shown in the order they ran. <kbd>Esc</kbd> closes the trace.</footer>
      </section>
    </div>
  );
}

function TraceActor({ kind, name, role, blocked }: { kind: "user" | "agent"; name: string; role: string; blocked?: boolean }) {
  return (
    <div className={`obs-trace-actor ${kind} ${blocked ? "blocked" : ""}`}>
      <span className="obs-trace-tile">{initials(name)}</span>
      <span className="obs-trace-name">{name}</span>
      <span className="obs-trace-role">{role}</span>
    </div>
  );
}

function TraceLink({ label }: { label: string }) {
  return (
    <div className="obs-trace-link quiet">
      <span className="obs-trace-action">{label}</span>
      <span className="obs-trace-line" />
    </div>
  );
}

function TraceHop({
  action,
  detail,
  latencyMs,
  blocked,
  to,
}: {
  action: string;
  detail: string;
  latencyMs: number;
  blocked: boolean;
  to: string;
}) {
  return (
    <>
      <div className={`obs-trace-link ${blocked ? "blocked" : ""}`} title={detail}>
        <span className="obs-trace-action">{action}</span>
        <span className="obs-trace-line">{blocked && <span className="obs-trace-x">✕</span>}</span>
        <span className="obs-trace-latency">{blocked ? "BLOCKED" : `${latencyMs}ms`}</span>
        <span className="obs-trace-detail">{detail}</span>
      </div>
      <TraceActor kind="agent" name={to} role="AGENT" blocked={blocked} />
    </>
  );
}
