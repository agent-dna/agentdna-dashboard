import { useState } from "react";
import { timeAgo } from "../lib/format";
import type { LogEntry, LogLevel } from "../types";

interface LogsTableProps {
  logs: LogEntry[];
}

const LEVELS: { key: LogLevel | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "info", label: "Info" },
  { key: "warn", label: "Warn" },
  { key: "error", label: "Error" },
  { key: "debug", label: "Debug" },
];

export function LogsTable({ logs }: LogsTableProps) {
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const rows = level === "all" ? logs : logs.filter((l) => l.level === level);

  return (
    <>
      <div className="tb-toolbar">
        <div className="filters">
          <div className="seg">
            {LEVELS.map((l) => (
              <button key={l.key} className={level === l.key ? "active" : ""} onClick={() => setLevel(l.key)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <span className="count">
          {rows.length} of {logs.length}
        </span>
      </div>
      <div className="table-wrap">
        <table className="dt">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Timestamp</th>
              <th style={{ width: 90 }}>Level</th>
              <th>Message</th>
              <th style={{ width: 200 }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--fg-muted)" }}>
                  No logs.
                </td>
              </tr>
            )}
            {rows.map((l) => (
              <tr key={l.id}>
                <td>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>
                    {timeAgo(l.ts)}
                  </span>
                </td>
                <td>
                  <span
                    className={`chip ${
                      l.level === "error" ? "threat" : l.level === "warn" ? "warn" : l.level === "info" ? "info" : ""
                    }`}
                    style={{ fontSize: 10.5, padding: "2px 8px", textTransform: "uppercase" }}
                  >
                    {l.level}
                  </span>
                </td>
                <td>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg)" }}>
                    {l.message}
                  </span>
                </td>
                <td>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>
                    {l.source}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
