import { useState, useEffect } from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  loading?: boolean;
  inline?: boolean;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, loading, inline, onChange }: PaginationProps) {
  const [input, setInput] = useState(String(page));

  useEffect(() => { setInput(String(page)); }, [page]);

  if (totalPages <= 1) return null;

  const from = pageSize ? (page - 1) * pageSize + 1 : null;
  const to = pageSize && total ? Math.min(page * pageSize, total) : null;

  const commit = () => {
    const n = parseInt(input, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= totalPages) onChange(n);
    else setInput(String(page));
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, ...(inline ? {} : { padding: "10px 16px", borderTop: "1px solid var(--line)" }) }}>
      {from !== null && to !== null && total != null && (
        <span style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", marginRight: 4 }}>
          {from}–{to} of {total}
        </span>
      )}
      <button
        className="btn primary"
        style={{ padding: "4px 12px", fontSize: 12.5 }}
        disabled={page <= 1 || loading}
        onClick={() => onChange(page - 1)}
      >
        Prev
      </button>
      <input
        type="number"
        min={1}
        max={totalPages}
        value={input}
        disabled={loading}
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        title={`Page ${page} of ${totalPages} — type a number and press Enter`}
        style={{
          width: 64,
          padding: "4px 8px",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
          color: "var(--fg)",
          background: "var(--bg)",
          border: "2px solid var(--accent)",
          borderRadius: 6,
          boxShadow: "0 0 0 3px rgba(37,99,235,0.12)",
          textAlign: "center",
          outline: "none",
        }}
      />
      <button
        className="btn primary"
        style={{ padding: "4px 12px", fontSize: 12.5 }}
        disabled={page >= totalPages || loading}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
