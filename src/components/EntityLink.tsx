import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useResolveName } from "../context/DirectoryContext";
import { entityPath } from "../lib/entityLinks";

interface EntityLinkProps {
  /** DID to resolve and link to. */
  did: string;
  /** Backend-supplied name, used when the directory has no entry. */
  fallbackName?: string;
  /** Render something other than the resolved name (e.g. a raw DID line). */
  children?: ReactNode;
  style?: CSSProperties;
  /**
   * Text colour, applied whether or not it ends up a link — linked identities
   * read as ordinary text and announce themselves on hover instead of by colour.
   */
  color?: string;
}

/**
 * Renders an identity as a link to its detail page — agents, apps and users
 * each have their own route. Falls back to plain text when the directory can't
 * resolve the DID, so we never render a link that goes nowhere.
 *
 * Clicks are stopped from propagating: these appear inside table rows that have
 * their own click handler, and navigating should win over the row action.
 *
 * Links are not colour-coded — the underline on hover plus the pointer cursor
 * carry the affordance, so the table keeps its normal text colour.
 */
export function EntityLink({ did, fallbackName, children, style, color }: EntityLinkProps) {
  const resolve = useResolveName();
  const navigate = useNavigate();

  const hit = resolve(did);
  const label = children ?? (hit.kind && hit.name ? hit.name : fallbackName?.trim() || hit.name || did || "—");
  const to = entityPath(hit.kind, did);

  if (!to) {
    return <span style={{ ...style, color }}>{label}</span>;
  }

  return (
    <a
      href={to}
      title={did}
      onClick={(e) => {
        // Let modified clicks (new tab, download) behave natively.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        navigate(to);
      }}
      style={{ ...style, color, textDecoration: "none", cursor: "pointer" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")}
    >
      {label}
    </a>
  );
}
