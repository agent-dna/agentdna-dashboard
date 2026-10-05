import { useRef, useState } from "react";

/** @deprecated Use IntentIdChip component instead for table display. */
export function useIntentLabel(): (id: string | undefined | null) => string {
  return (id) => {
    if (!id) return "—";
    return id;
  };
}

function truncateId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}...${id.slice(-3)}`;
}

/** Renders a truncated intent ID with a hover tooltip showing the full value. */
export function IntentIdChip({ id, style }: { id: string | undefined | null; style?: React.CSSProperties }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  if (!id) return <span>—</span>;

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.top - 36 + window.scrollY, left: rect.left + rect.width / 2 + window.scrollX });
    }
    setVisible(true);
  };

  return (
    <>
      <span
        ref={ref}
        style={{ cursor: "default", ...style }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
      >
        {truncateId(id)}
      </span>
      {visible && (
        <span style={{
          position: "absolute",
          top: pos.top,
          left: pos.left,
          transform: "translateX(-50%)",
          background: "#0F2046",
          color: "#C9D6EE",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 500,
          padding: "5px 10px",
          borderRadius: 7,
          border: "1px solid rgba(255,255,255,0.1)",
          whiteSpace: "nowrap",
          zIndex: 9999,
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}>
          {id}
        </span>
      )}
    </>
  );
}
