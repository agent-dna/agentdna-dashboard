import { useMemo, useState, type ReactNode } from "react";

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
}

export function DataTable<R extends { id?: string }>({
  columns,
  rows,
  onRowClick,
  selectedId,
  emptyText = "No data",
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
                style={{ width: c.width, textAlign: c.align || "left" }}
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
              style={{ cursor: onRowClick ? "pointer" : "default" }}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || "left", width: c.width }}>
                  {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
