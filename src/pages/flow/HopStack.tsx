import type { CSSProperties, KeyboardEvent } from "react";
import { Icon } from "../../components/Icon";
import { branchTone } from "./branchPalette";
import type { FlowBranch } from "./flowData";
import { clock, pad2, type TraceHop, type TraceModel } from "./traceModel";

/**
 * The selected hop with its neighbours, pinned to the graph's top-left corner: the hop before it
 * above, the hop after it below. It follows playback and stepping; clicking a neighbour selects it.
 *
 * The cards sit on a reel: every card is the same size, placed in a slot by transform, with the
 * neighbours scaled down and faded. Stepping slides every card one slot (the one leaving fades
 * out past the top, the next fades in from below). Only transform and opacity animate, so nothing
 * re-lays out mid-move and the motion stays smooth.
 */

/** Slot offset from the selected hop: -2 and 2 sit just off the reel, invisible, ready to slide in. */
type Offset = -2 | -1 | 0 | 1 | 2;

/** Card height and gap, in px; the neighbours are drawn at NEIGHBOUR_SCALE. Keep CARD_H in step with .tr-rc. */
const CARD_H = 58;
const GAP = 8;
const NEIGHBOUR_SCALE = 0.92;
const SMALL_H = CARD_H * NEIGHBOUR_SCALE;

/** Where each slot sits: its top, scale, sideways indent and opacity. */
const SLOT: Record<Offset, { y: number; scale: number; x: number; opacity: number }> = {
  [-2]: { y: -(SMALL_H + GAP), scale: NEIGHBOUR_SCALE, x: 10, opacity: 0 },
  [-1]: { y: 0, scale: NEIGHBOUR_SCALE, x: 10, opacity: 0.62 },
  [0]: { y: SMALL_H + GAP, scale: 1, x: 0, opacity: 1 },
  [1]: { y: SMALL_H + GAP + CARD_H + GAP, scale: NEIGHBOUR_SCALE, x: 10, opacity: 0.62 },
  [2]: { y: SMALL_H + GAP + CARD_H + GAP + SMALL_H + GAP, scale: NEIGHBOUR_SCALE, x: 10, opacity: 0 },
};
const REEL_H = SLOT[1].y + SMALL_H;

export function HopStack({
  model,
  sel,
  playing,
  atEnd,
  onTogglePlay,
  onPrev,
  onNext,
  onSelect,
  onEnvelope,
  branches,
  pathLeaf,
  onPath,
}: {
  model: TraceModel;
  sel: number;
  playing: boolean;
  atEnd: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (n: number) => void;
  onEnvelope: () => void;
  /** Leaf branches; a path picker shows when the intent forked. */
  branches: FlowBranch[];
  pathLeaf: string | null;
  onPath: (leaf: string | null) => void;
}) {
  const total = model.hops.length;
  const name = (id: string) => model.nodeById.get(id)?.name ?? id;

  // The reel: hops sel-2 … sel+2, plus "Start" / "End" markers where the trace runs out.
  // Keyed by hop, so a card keeps its element as it slides from slot to slot.
  const reel: { key: string; off: Offset; n: number; hop?: TraceHop; edge?: "start" | "end" }[] = [];
  for (const off of [-2, -1, 0, 1, 2] as Offset[]) {
    const n = sel + off;
    const hop = model.hops[n - 1];
    if (hop) reel.push({ key: `h${n}`, off, n, hop });
    else if (n === 0) reel.push({ key: "start", off, n, edge: "start" });
    else if (n === total + 1) reel.push({ key: "end", off, n, edge: "end" });
  }

  return (
    <div className="tr-stack nopan nowheel" aria-label="Hops around the selected one">
      <div className="tr-stack-head">
        <div className="tr-stack-transport">
          <button type="button" className="tr-stack-step" onClick={onPrev} disabled={sel <= 1} title="Previous hop (↑)" aria-label="Previous hop">
            <Icon name="chevronLeft" size={13} />
          </button>
          <button type="button" className="tr-stack-play" onClick={onTogglePlay} title="Play / pause (Space)">
            <Icon name={playing ? "pause" : "play"} size={11} />
            {playing ? "Pause" : atEnd ? "Replay" : "Resume"}
          </button>
          <button type="button" className="tr-stack-step" onClick={onNext} disabled={atEnd} title="Next hop (↓)" aria-label="Next hop">
            <Icon name="chevron" size={13} />
          </button>
        </div>
        <span className="tr-stack-pos">
          Hop {pad2(sel)}
          <span> of {pad2(total)}</span>
        </span>
        <button type="button" className="tr-env-btn" onClick={onEnvelope}>
          <Icon name="flow" size={12} />
          Envelope
        </button>
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

      <div className="tr-reel" style={{ height: REEL_H }}>
        {reel.map((c) => {
          const at = SLOT[c.off];
          const style = { transform: `translate(${at.x}px, ${at.y}px) scale(${at.scale})`, opacity: at.opacity };
          // Off-reel cards are there only to slide in; nobody can see, reach or click them.
          const hidden = c.off === -2 || c.off === 2;
          if (c.edge) {
            return (
              <div key={c.key} className="tr-rc edge" style={style} aria-hidden={hidden || undefined}>
                {c.edge === "start" ? "Start of trace" : "End of trace"}
              </div>
            );
          }
          return (
            <HopCard key={c.key} hop={c.hop!} name={name} cur={c.off === 0} hidden={hidden} style={style} onSelect={onSelect} up={c.off < 0} />
          );
        })}
      </div>
    </div>
  );
}

function HopCard({
  hop,
  name,
  cur,
  hidden,
  up,
  style,
  onSelect,
}: {
  hop: TraceHop;
  name: (id: string) => string;
  cur: boolean;
  hidden: boolean;
  /** Sits above the selected hop (for the tooltip). */
  up: boolean;
  style: CSSProperties;
  onSelect: (n: number) => void;
}) {
  const clickable = !cur && !hidden;
  const go = () => onSelect(hop.n);
  return (
    <div
      className={`tr-rc${cur ? " cur" : ""}${hop.blocked ? " blocked" : ""}`}
      style={style}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-hidden={hidden || undefined}
      aria-current={cur ? "step" : undefined}
      title={clickable ? (up ? "Previous hop (↑)" : "Next hop (↓)") : undefined}
      onClick={clickable ? go : undefined}
      onKeyDown={
        clickable
          ? (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                go();
              }
            }
          : undefined
      }
    >
      <span className={`tr-rc-num${hop.blocked ? " red" : ""}`}>{pad2(hop.n)}</span>
      <span className="tr-rc-main">
        <span className="tr-rc-names">
          <span>{name(hop.src)}</span>
          <span className="arrow">→</span>
          <span>{name(hop.dst)}</span>
        </span>
        <span className="tr-rc-meta">
          <span className="op">{`${hop.protocol} · ${hop.op}`}</span>
          {hop.cred && (
            <span
              className={`tr-rc-tag ${hop.cred.tone}`}
              title={hop.cred.reusedFrom ? `Same credential as hop ${pad2(hop.cred.reusedFrom)}` : "Carried a credential"}
            >
              <Icon name="key" size={10} />
              {hop.cred.label}
            </span>
          )}
          {hop.blocked && <span className="tr-rc-tag bad">Blocked</span>}
          {hop.time && <span className="t">{clock(hop.time)}</span>}
        </span>
      </span>
    </div>
  );
}
