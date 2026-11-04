import { useEffect, useRef } from "react";
import { Icon } from "../../components/Icon";
import { branchTone } from "./branchPalette";
import type { FlowBranch } from "./flowData";
import { clock, pad2, type TraceModel } from "./traceModel";

/**
 * The trace's hops in order, filterable to the ones that carried a credential or were
 * blocked. Picking a hop selects it everywhere; the selected card stays scrolled into view.
 */

export type HopFilter = "all" | "cred" | "blocked";

export function TraceTimeline({
  model,
  sel,
  filter,
  onFilter,
  onSelect,
  onEnvelope,
  branches,
  pathLeaf,
  onPath,
  loading,
}: {
  model: TraceModel | null;
  sel: number;
  filter: HopFilter;
  onFilter: (f: HopFilter) => void;
  onSelect: (n: number) => void;
  onEnvelope: () => void;
  /** Leaf branches; a path picker shows when the intent forked. */
  branches: FlowBranch[];
  pathLeaf: string | null;
  onPath: (leaf: string | null) => void;
  loading: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const L = listRef.current;
    const c = L?.querySelector<HTMLElement>(`[data-hop="${sel}"]`);
    if (!L || !c) return;
    const t = c.offsetTop, b = t + c.offsetHeight;
    if (t < L.scrollTop + 4) L.scrollTo({ top: t - 8, behavior: "smooth" });
    else if (b > L.scrollTop + L.clientHeight) L.scrollTo({ top: b - L.clientHeight + 8, behavior: "smooth" });
  }, [sel, filter]);

  const hops = model?.hops ?? [];
  const counts: Record<HopFilter, number> = {
    all: hops.length,
    cred: model?.credHops.length ?? 0,
    blocked: model?.blockedHops.length ?? 0,
  };
  const list = hops.filter((h) => filter === "all" || (filter === "cred" ? !!h.cred : h.blocked));
  const name = (id: string) => model?.nodeById.get(id)?.name ?? id;

  return (
    <section className="tr-timeline" aria-label="Interaction timeline">
      <div className="tr-tl-head">
        <div className="tr-tl-title">
          <h2>Interaction timeline</h2>
          {model && <span className="tr-tl-count">{hops.length} hops</span>}
          <button type="button" className="tr-env-btn" onClick={onEnvelope} disabled={!model}>
            <Icon name="flow" size={13} />
            Envelope
          </button>
        </div>
        <div className="tr-filters" role="group" aria-label="Show hops">
          {(
            [
              ["all", "All"],
              ["cred", "Credential"],
              ["blocked", "Blocked"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} className={filter === key ? "on" : ""} onClick={() => onFilter(key)}>
              {label}
              <span>{counts[key]}</span>
            </button>
          ))}
        </div>
        {branches.length > 0 && (
          <div className="tr-paths" role="group" aria-label="Branch shown">
            <button type="button" className={pathLeaf == null ? "on" : ""} onClick={() => onPath(null)}>
              All branches
            </button>
            {branches.map((b) => (
              <button
                key={b.key}
                type="button"
                className={pathLeaf === b.key ? "on" : ""}
                onClick={() => onPath(b.key)}
                title={`Play the main path and ${b.name}`}
              >
                <span className="tr-swatch" style={{ background: branchTone(b).ui }} />
                {b.name.replace(/^Branch /, "")}
                {b.blocked && <span className="tr-blk" title="Has a blocked hop" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="tr-skel">
          {[1, 0.8, 0.6, 0.45, 0.3].map((o) => (
            <div key={o} style={{ opacity: o }} />
          ))}
        </div>
      ) : !model ? (
        <div className="tr-tl-empty">No hops to show.</div>
      ) : (
        <div className="tr-tl-list" ref={listRef}>
          {list.map((h) => {
            const on = h.n === sel;
            return (
              <div key={h.n} data-hop={h.n} className="tr-hop">
                <div className="tr-rail">
                  <span className={`tr-num${on ? " on" : ""}${h.blocked ? " red" : ""}`}>{pad2(h.n)}</span>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  aria-current={on}
                  className={`tr-hop-card${on ? " on" : ""}`}
                  onClick={() => onSelect(h.n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(h.n);
                  }}
                >
                  <div className="tr-hop-names">
                    <span className="tr-hop-from">
                      <span>{name(h.src)}</span>
                      {h.time && <span className="t">{clock(h.time)}</span>}
                    </span>
                    <span>
                      <span className="arrow">→ </span>
                      {name(h.dst)}
                    </span>
                  </div>
                  {(h.cred || h.blocked) && (
                    <div className="tr-hop-tags">
                      {h.cred && (
                        <span
                          className={`tr-cred-badge ${h.cred.tone}`}
                          title={h.cred.reusedFrom ? `Same credential as hop ${pad2(h.cred.reusedFrom)}` : `${h.checks.length} auth check${h.checks.length === 1 ? "" : "s"}`}
                        >
                          <Icon name="key" size={11} />
                          Credential
                        </span>
                      )}
                      {h.blocked && (
                        <span className="chip threat">
                          <span className="dot-status threat" />
                          Blocked
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {list.length === 0 && <div className="tr-tl-empty">No hops match this filter.</div>}
        </div>
      )}
    </section>
  );
}
