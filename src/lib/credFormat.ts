/** How auth-check fields are worded across the dashboard (flow page, app credentials). */

/** "bearer_opaque" → "Bearer (opaque)", "api_key" → "API key". */
export function authMethodLabel(m: string): string {
  const s = (m || "").toLowerCase();
  if (!s) return "";
  if (s.startsWith("bearer")) {
    const rest = s.slice(6).replace(/^[_\s-]+/, "").replace(/_/g, " ");
    return rest ? `Bearer (${rest})` : "Bearer";
  }
  if (s === "api_key" || s === "apikey") return "API key";
  const t = s.replace(/_/g, " ");
  return t[0].toUpperCase() + t.slice(1);
}

/** "server_in" → "Server in". */
export const sentence = (s: string) => {
  const t = (s || "").replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};
