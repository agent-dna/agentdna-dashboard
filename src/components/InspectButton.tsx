import type { MouseEvent } from "react";
import { Icon } from "./Icon";

/**
 * The one Inspect button used across the dashboard's tables: solid navy with an ↗ icon. It stops
 * the click from reaching the row, so a row that also opens on click doesn't fire twice.
 */
export function InspectButton({ onClick, title }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      className="inspect-btn"
      title={title}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon name="arrowUpRight" size={11} />
      Inspect
    </button>
  );
}
