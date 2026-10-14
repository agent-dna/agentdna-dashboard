/**
 * Reading an auth-evidence `destination` ("POST https://learn.microsoft.com/api/mcp",
 * "POST http://localhost:8000/learn", or just "127.0.0.1"): the HTTP method, where it went,
 * and which service that is, so the interaction drawer can show a name and logo for it.
 */

export type DestinationEntity = "onedrive" | "microsoft" | "local" | "web";

export interface ParsedDestination {
  /** As sent. */
  raw: string;
  /** "POST", "GET", …, when the destination starts with one. */
  method?: string;
  /** e.g. "learn.microsoft.com", "localhost". */
  host: string;
  /** Port, when the URL has one. */
  port?: string;
  /** Path and query, e.g. "/api/mcp"; "" for a bare host. */
  path: string;
  entity: DestinationEntity;
  /** e.g. "Microsoft Learn", "OneDrive", "Local service". */
  name: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "host.docker.internal"]);

export function parseDestination(raw: string): ParsedDestination {
  const text = raw.trim();
  const m = /^([A-Z]+)\s+(.+)$/.exec(text);
  const method = m?.[1];
  const target = m ? m[2] : text;

  let host = target;
  let port: string | undefined;
  let path = "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : `http://${target}`);
    host = url.hostname;
    port = url.port || undefined;
    path = `${url.pathname === "/" ? "" : url.pathname}${url.search}`;
  } catch {
    /* not a URL: keep it whole as the host */
  }

  const h = host.toLowerCase();
  const p = path.toLowerCase();
  let entity: DestinationEntity = "web";
  let name = host || text;
  if (h.includes("onedrive") || (h === "graph.microsoft.com" && /\/drives?\b|\/drive\//.test(p))) {
    entity = "onedrive";
    name = "OneDrive";
  } else if (h === "learn.microsoft.com") {
    entity = "microsoft";
    name = "Microsoft Learn";
  } else if (h === "graph.microsoft.com") {
    entity = "microsoft";
    name = "Microsoft Graph";
  } else if (/(^|\.)(microsoft\.com|microsoftonline\.com|office\.com|office365\.com|live\.com)$/.test(h)) {
    entity = "microsoft";
    name = "Microsoft";
  } else if (LOCAL_HOSTS.has(h) || h.endsWith(".local") || h.endsWith(".internal")) {
    entity = "local";
    name = "Local service";
  }

  return { raw: text, method, host, port, path, entity, name };
}
