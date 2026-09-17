import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

export interface DataTableColumn<R> {
  key: string;
  label: string;
  width?: number | string;
  align?: "left" | "right" | "center";
  render?: (row: R) => ReactNode;
  sortFn?: (a: R, b: R) => number;
}

interface DataTableProps<R extends { id?: string }> {
  columns: DataTableColumn<R>[];
  rows: R[];
  onRowClick?: (row: R) => void;
  selectedId?: string | null;
  emptyText?: string;
  /** Extra inline style per row, e.g. tinting threat rows red. */
  rowStyle?: (row: R) => CSSProperties | undefined;
}

export function DataTable<R extends { id?: string }>({
  columns,
  rows,
  onRowClick,
  selectedId,
  emptyText = "No data",
  rowStyle,
}: DataTableProps<R>) {
  const [sort, setSort] = useState<{ key: string | null; dir: 1 | -1 }>({ key: null, dir: 1 });

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col || !col.sortFn) return rows;
    const sortFn = col.sortFn;
    return [...rows].sort((a, b) => sort.dir * sortFn(a, b));
  }, [rows, sort, columns]);

  return (
    <div className="table-wrap">
      <table className="dt" style={{ width: "100%", tableLayout: "fixed" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={sort.key === c.key ? "active" : ""}
                style={{ width: c.width, textAlign: "center" }}
                onClick={() =>
                  c.sortFn &&
                  setSort((s) => ({
                    key: c.key,
                    dir: s.key === c.key ? ((-s.dir) as 1 | -1) : 1,
                  }))
                }
              >
                {c.label}
                {c.sortFn && (
                  <span className="sort">{sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : "↕"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center", padding: 40, color: "var(--fg-muted)" }}>
                {emptyText}
              </td>
            </tr>
          )}
          {sorted.map((row, i) => (
            <tr
              key={row.id || i}
              className={selectedId && row.id === selectedId ? "selected" : ""}
              onClick={() => onRowClick && onRowClick(row)}
              style={{ cursor: onRowClick ? "pointer" : "default", ...rowStyle?.(row) }}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ width: c.width }}>
                  {/* A centered flex wrapper (not just text-align) so this
                      centers everything a column can render — plain text,
                      pills/chips, and multi-element rows like an icon+name
                      flex container — regardless of what alignment that
                      column's own render() markup was built with. */}
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                    {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
