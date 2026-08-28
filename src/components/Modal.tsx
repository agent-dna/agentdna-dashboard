import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, title, onClose, children, footer, width = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 34, 64, 0.32)",
        backdropFilter: "blur(2px)",
        // Modal instances render nested inside `.app`'s stacking context, so this
        // has to clear every other z-index used there (topbar: 100, drawer: 200/201)
        // or those elements paint above the dimmed backdrop instead of under it.
        zIndex: 300,
        display: "grid",
        placeItems: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "92vw",
          maxHeight: "90vh",
          background: "var(--bg-1)",
          border: "1px solid var(--line-strong)",
          borderRadius: 14,
          boxShadow: "0 30px 80px rgba(10, 34, 64, 0.20)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              margin: 0,
              color: "var(--fg)",
              flex: 1,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              border: "1px solid var(--line)",
              background: "transparent",
              borderRadius: 8,
              color: "var(--fg-dim)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            aria-label="Close"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ padding: 22, overflow: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
