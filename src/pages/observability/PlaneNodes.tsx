import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "../../components/Icon";

/**
 * Node bodies for the observability plane. These are ordinary DOM, so they pick up
 * the app's CSS variables and theme the same way every other surface does.
 *
 * Each kind carries its own silhouette, hue and glyph, so the actor types stay apart
 * even zoomed out far enough that labels drop away:
 *   agent → circle · app/tool → hexagon · user → pentagon · intent → card
 */

export type PlaneShape = "circle" | "hexagon" | "pentagon";

export interface PlaneNodeData extends Record<string, unknown> {
  label: string;
  sub: string;
  color: string;
  icon?: "agents" | "box" | "user" | "intents";
  /** Silhouette for the entity kind. Intents render as a card and set none. */
  shape?: PlaneShape;
  /** Small trailing figure, e.g. an intent's hop count. */
  meta?: string;
  /** Intents only: ringed when the intent was blocked or high risk. */
  flagged?: boolean;
  dim?: boolean;
  selected?: boolean;
}

const SHAPE_SIZE = 46;

/** Drawn in a 0–100 box and scaled, so one set of points serves any size. */
const SHAPE_POINTS: Record<Exclude<PlaneShape, "circle">, string> = {
  hexagon: "50,2 93,26 93,74 50,98 7,74 7,26",
  pentagon: "50,3 97,38 79,94 21,94 3,38",
};

const SIDES = [
  { id: "t", pos: Position.Top },
  { id: "r", pos: Position.Right },
  { id: "b", pos: Position.Bottom },
  { id: "l", pos: Position.Left },
] as const;

const hiddenHandle: React.CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 1,
  minHeight: 1,
  border: "none",
  pointerEvents: "none",
};

/**
 * Rendered inside the shape rather than the outer node, so edges aim at the
 * silhouette instead of the bottom of the label block.
 */
function Handles() {
  return (
    <>
      {SIDES.map((s) => (
        <span key={s.id}>
          <Handle type="target" id={s.id} position={s.pos} style={hiddenHandle} />
          <Handle type="source" id={s.id} position={s.pos} style={hiddenHandle} />
        </span>
      ))}
    </>
  );
}

function Shape({ d }: { d: PlaneNodeData }) {
  const points = SHAPE_POINTS[(d.shape ?? "hexagon") as Exclude<PlaneShape, "circle">];
  const stroke = d.selected ? 5 : 3.5;
  return (
    <div
      className="obs-plane-shape"
      style={{ position: "relative", width: SHAPE_SIZE, height: SHAPE_SIZE, flexShrink: 0 }}
    >
      <svg
        width={SHAPE_SIZE}
        height={SHAPE_SIZE}
        viewBox="0 0 100 100"
        style={{
          display: "block",
          overflow: "visible",
          filter: `drop-shadow(0 0 ${d.selected ? 10 : 6}px ${d.color}40)`,
        }}
      >
        {/* Opaque fill first, then a tint on top, so the dot grid never shows through. */}
        {d.shape === "circle" ? (
          <>
            <circle cx="50" cy="50" r="46" fill="var(--bg-1)" stroke={d.color} strokeWidth={stroke} vectorEffect="non-scaling-stroke" />
            <circle cx="50" cy="50" r="46" fill={d.color} opacity={0.1} />
          </>
        ) : (
          <>
            <polygon points={points} fill="var(--bg-1)" stroke={d.color} strokeWidth={stroke} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polygon points={points} fill={d.color} opacity={0.1} />
          </>
        )}
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
        {d.icon && <Icon name={d.icon} size={17} style={{ color: d.color }} />}
      </span>
      <Handles />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  font: "650 12px var(--font-body)",
  color: "var(--fg)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 136,
  textAlign: "center",
  letterSpacing: "-0.01em",
};

function subStyle(color: string): React.CSSProperties {
  return {
    font: "700 8.5px var(--font-body)",
    letterSpacing: "0.1em",
    color,
    marginTop: 2,
    textAlign: "center",
  };
}

/** Apps, agents and users share a body — only the silhouette, glyph and hue differ. */
export const EntityNode = memo(({ data }: NodeProps) => {
  const d = data as PlaneNodeData;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        opacity: d.dim ? 0.14 : 1,
        transition: "opacity 160ms",
        cursor: "pointer",
      }}
    >
      <Shape d={d} />
      <div>
        <div style={labelStyle}>{d.label}</div>
        <div style={subStyle(d.color)}>{d.sub}</div>
      </div>
    </div>
  );
});
EntityNode.displayName = "EntityNode";

/** Intents are the work itself, so they stay a card keyed to run status, not an actor shape. */
export const IntentNode = memo(({ data }: NodeProps) => {
  const d = data as PlaneNodeData;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        borderRadius: 10,
        background: "var(--bg-1)",
        border: `1px ${d.flagged ? "dashed" : "solid"} ${d.color}59`,
        boxShadow: d.selected
          ? `0 0 0 3px ${d.color}2b, 0 6px 16px rgba(15,32,70,0.12)`
          : "0 1px 3px rgba(15,32,70,0.08)",
        opacity: d.dim ? 0.14 : 1,
        transition: "opacity 160ms, box-shadow 160ms",
        cursor: "pointer",
      }}
    >
      <Handles />
      <span
        style={{
          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
          display: "grid", placeItems: "center", background: `${d.color}1a`,
        }}
      >
        <Icon name="intents" size={13} style={{ color: d.color }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...labelStyle, textAlign: "left", maxWidth: 152 }}>{d.label}</div>
        <div style={{ ...subStyle(d.color), textAlign: "left", marginTop: 1 }}>{d.sub}</div>
      </div>
      {d.meta && (
        <span
          style={{
            font: "600 9.5px var(--font-body)",
            color: "var(--fg-muted)",
            background: "var(--bg-3)",
            padding: "3px 7px",
            borderRadius: 999,
            flexShrink: 0,
            marginLeft: 2,
          }}
        >
          {d.meta}
        </span>
      )}
    </div>
  );
});
IntentNode.displayName = "IntentNode";

export const PLANE_NODE_TYPES = { entity: EntityNode, intent: IntentNode };
