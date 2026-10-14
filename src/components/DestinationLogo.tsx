import { Globe, Server } from "lucide-react";
import type { DestinationEntity } from "../lib/destination";

/**
 * The mark for where an interaction's call went (see lib/destination): Microsoft's four
 * squares, the OneDrive cloud, a server for a local service, a globe for anything else.
 * Inline SVG, so nothing is fetched from outside.
 */
export function DestinationLogo({ entity, size = 22 }: { entity: DestinationEntity; size?: number }) {
  if (entity === "microsoft") {
    return (
      <svg className="dest-logo" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
        <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
        <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
        <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
      </svg>
    );
  }
  if (entity === "onedrive") {
    return (
      <svg className="dest-logo" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d="M9.6 8.2a5.6 5.6 0 0 1 9.9 2.6 4 4 0 0 1 .3 7.9H7.3L9.6 8.2Z" fill="#0364B8" />
        <path d="M9.4 8.3 7.3 18.7H5a4.2 4.2 0 0 1-.5-8.4 5 5 0 0 1 4.9-2Z" fill="#0078D4" />
        <path d="M19.5 10.8a4 4 0 0 1 .3 7.9H7.3l5.2-6.1a5.5 5.5 0 0 1 7-1.8Z" fill="#1490DF" />
        <path d="M12.5 12.6 7.3 18.7H5a4.2 4.2 0 0 1-2.3-7.7 4.3 4.3 0 0 1 9.8 1.6Z" fill="#28A8EA" />
      </svg>
    );
  }
  const Ic = entity === "local" ? Server : Globe;
  return (
    <span className={`dest-logo dest-logo-icon ${entity}`} style={{ width: size, height: size }} aria-hidden>
      <Ic size={Math.round(size * 0.62)} strokeWidth={2} />
    </span>
  );
}
