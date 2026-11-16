import type { TrustStatus } from "../data/api";
import { trustStatusLabel, trustStatusTone } from "../lib/trustStatus";

/** A resource's trust status: green trusted, amber unreviewed, red flagged. */
export function TrustStatusChip({ value, title }: { value: TrustStatus; title?: string }) {
  return (
    <span className={`chip ${trustStatusTone(value)}`} style={{ fontSize: 11, padding: "2px 8px" }} title={title}>
      {trustStatusLabel(value)}
    </span>
  );
}
