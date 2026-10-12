import { fetchIntentAuthEvidence } from "../api/observability";
import { useResolveName } from "../context/DirectoryContext";
import { loadIntentDetail } from "../pages/observability/intentDetail";
import { CustodyChain, shortId } from "../pages/observability/IntentDetailPanel";
import { useObsQuery } from "../pages/observability/useObsQuery";

/**
 * Evidence trail tab of the intent page: the same chain of custody as the observability
 * Intent Info tab (CustodyChain), each step with "Credential info" for its auth checks and
 * "View more", which opens the interaction in the drawer.
 * Data: `/intent-info` (shared cache) for the chain, `/intent-auth-evidence` for the evidence.
 */
export function IntentEvidenceTrail({ intentId }: { intentId: string }) {
  const resolve = useResolveName();
  const detail = useObsQuery(`intent-detail:${intentId}`, () => loadIntentDetail(intentId, intentId));
  const evidence = useObsQuery(`auth-evidence:${intentId}`, () => fetchIntentAuthEvidence(intentId));
  const name = (did: string, given?: string) => (given && !given.includes("…") ? given : resolve(did).name || shortId(did));

  if (detail.loading) return <div className="ix-empty">Loading the chain of custody…</div>;
  if (detail.error || !detail.data) {
    return (
      <div className="ix-empty">
        {detail.error ? `Couldn't load this intent's interactions: ${detail.error}. ` : "No interactions were recorded for this intent. "}
        {detail.error && <button type="button" className="btn ghost" onClick={detail.retry}>Try again</button>}
      </div>
    );
  }

  return (
    <div className="et">
      {evidence.error && (
        <div className="et-note">
          Couldn't load the credential info: {evidence.error}.{" "}
          <button type="button" className="btn ghost" onClick={evidence.retry}>Try again</button>
        </div>
      )}
      <CustodyChain intent={detail.data} name={name} evidence={evidence.data} viewMore />
    </div>
  );
}
