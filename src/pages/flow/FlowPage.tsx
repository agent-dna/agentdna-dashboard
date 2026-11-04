import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { TraceInspector } from "../../components/TraceInspector";
import { useIntent, useIntentInteractions } from "../../data/hooks";
import { useDirectory, useResolveName } from "../../context/DirectoryContext";
import { useTopbarSlot } from "../../context/TopbarSlotContext";
import { buildFlowFromIntent, buildInteractionTrace, flowForPath, intentEnvelope, type Flow } from "./flowData";
import { fetchIntents } from "../../data/api";
import { buildTrace } from "./traceModel";
import { HopStack } from "./HopStack";
import { TraceGraph } from "./TraceGraph";
import { FlowDetailBox, type FlowTab } from "./FlowDetailBox";
import type { Intent, Interaction } from "../../types";

/** How long each hop holds during playback. */
const STEP_MS = 1500;

export function FlowPage() {
  const { intentId: paramId } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const resolve = useResolveName();
  const directory = useDirectory();
  const activeId = paramId || "";
  const topbarSlot = useTopbarSlot();

  // Landing on /graph with no intent in the URL: fall through to the caller's
  // most recent intent. /intent-list is scoped by the auth token, so a user and
  // an admin each land on their own latest flow.
  const [noIntents, setNoIntents] = useState(false);
  useEffect(() => {
    if (paramId) return;
    let cancelled = false;
    fetchIntents(1)
      .then((list) => {
        if (cancelled) return;
        // `started` is minutes-ago, so the smallest value is the newest intent.
        const latest = list.reduce<Intent | null>((best, i) => (best === null || i.started < best.started ? i : best), null);
        if (latest) navigate(`/graph/${encodeURIComponent(latest.id)}`, { replace: true });
        else setNoIntents(true);
      })
      .catch(() => {
        if (!cancelled) setNoIntents(true);
      });
    return () => {
      cancelled = true;
    };
  }, [paramId, navigate]);

  const { data: intent, loading: intentLoading, error: intentError, refetch: refetchIntent } = useIntent(activeId);
  const { data: interactions, loading: ixLoading, error: ixError, refetch: refetchIx } = useIntentInteractions(activeId);
  const loadError = intentError ?? ixError;
  // The agents' own envelope chain, from /intent-info's rawData (the same response as above).
  const envelope = useMemo(() => intentEnvelope(interactions), [interactions]);

  // `resolve` is a new function every render; the directory it reads from is what changes.
  const flow: Flow | null = useMemo(
    () => (intent ? buildFlowFromIntent({ intent, interactions, resolve }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intent, interactions, directory],
  );

  // Which path through the branch tree shows: null = every branch, else a leaf branch key.
  const [path, setPath] = useState<{ intent: string; leaf: string | null }>({ intent: "", leaf: null });
  const pathLeaf = path.intent === activeId && flow?.branches.some((b) => b.key === path.leaf) ? path.leaf : null;
  const view: Flow | null = useMemo(() => (flow ? flowForPath(flow, pathLeaf) : null), [flow, pathLeaf]);
  const leaves = useMemo(() => (flow?.branches ?? []).filter((b) => b.leaf), [flow]);

  const interactionById = useMemo(() => new Map(interactions.map((ix) => [ix.id, ix])), [interactions]);
  const model = useMemo(() => (view ? buildTrace(view, interactionById) : null), [view, interactionById]);
  const total = model?.hops.length ?? 0;

  // The Envelope inspector lists interactions, nested by who called whom.
  const interactionTrace = useMemo(() => {
    if (!flow) return null;
    const nameByDid = new Map(flow.nodes.filter((n) => n.did).map((n) => [n.did!, n.name]));
    return buildInteractionTrace(flow.intent, interactions, (did) => nameByDid.get(did));
  }, [flow, interactions]);
  const interactionBySpanId = useMemo(() => Object.fromEntries(interactions.map((ix) => [ix.id, ix])) as Record<string, Interaction>, [interactions]);

  // Which trace is on screen. The model is rebuilt when names resolve; this only changes when
  // the intent, the path or the hops do.
  const traceKey = `${activeId}|${pathLeaf ?? ""}|${total}`;

  // Selection and playback. A newly opened trace (or path) replays from hop 01.
  const [sel, setSelRaw] = useState<{ key: string; n: number; playing: boolean }>({ key: "", n: 1, playing: true });
  const fresh = sel.key !== traceKey;
  const cur = fresh ? 1 : Math.min(Math.max(1, sel.n), Math.max(1, total));
  const playing = fresh ? total > 1 : sel.playing;
  const setSel = useCallback((n: number, play = false) => setSelRaw({ key: traceKey, n, playing: play }), [traceKey]);

  useEffect(() => {
    if (!playing || total === 0) return;
    const t = window.setTimeout(() => {
      if (cur >= total) setSelRaw({ key: traceKey, n: cur, playing: false });
      else setSelRaw({ key: traceKey, n: cur + 1, playing: true });
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, cur, total, traceKey]);

  const togglePlay = () => {
    if (playing) setSel(cur, false);
    else setSel(cur >= total ? 1 : cur, true);
  };
  const stepBy = (d: number) => setSel(Math.max(1, Math.min(total, cur + d)));

  const [tab, setTab] = useState<FlowTab>("intent");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectSpanId, setInspectSpanId] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  /** A credential key on the graph: select its hop and bring up Intent Info, where each step lists its checks. */
  const openCred = (n: number) => {
    setSel(n);
    setTab("intent");
    setInspectorOpen(true);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  /** Clicking a node steps through the hops it took part in. */
  const onNodeClick = (id: string) => {
    if (!model) return;
    const mine = model.hops.filter((h) => h.src === id || h.dst === id || h.outside.includes(id)).map((h) => h.n);
    if (mine.length === 0) return;
    setSel(mine.find((n) => n > cur) ?? mine[0]);
  };

  // ↑ ↓ (or k j) step a hop, Space plays or pauses. Esc does nothing here: the info box stays open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inspectSpanId !== null || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        stepBy(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        stepBy(-1);
      } else if (e.key === " " && t?.tagName !== "BUTTON") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hop = model?.hops[cur - 1];
  const loading = !noIntents && !loadError && (!activeId || intentLoading || ixLoading);
  const showInspector = inspectorOpen && !!hop && !!model;
  // /intent-info has no title: the request that opened the intent stands in for one.
  const firstTime = model?.hops.find((h) => h.time)?.time;
  const opening = model?.hops[0]?.ix?.payload;
  const title = intent
    ? [opening ? clip(opening, 64) : `Intent ${intent.id.slice(-8)}`, firstTime ? formatWhen(firstTime) : ""].filter(Boolean).join(" · ")
    : "";

  const gridClass = `tr-grid${showInspector ? " with-insp" : ""}`;

  return (
    <div className="page tr-page">
      {topbarSlot && title && createPortal(<div className="tr-topbar-title" title={intent?.id}>{title}</div>, topbarSlot)}
      <div className={gridClass}>
        <div className="tr-main">
        {!loading && model && total > 0 ? (
          <TraceGraph
            model={model}
            traceKey={traceKey}
            sel={cur}
            playing={playing}
            onSelect={(n) => setSel(n)}
            onOpenCred={openCred}
            onNodeClick={onNodeClick}
            inspectorOpen={showInspector}
            onToggleInspector={() => setInspectorOpen((o) => !o)}
            topLeft={
              <HopStack
                model={model}
                sel={cur}
                playing={playing}
                atEnd={cur >= total}
                onTogglePlay={togglePlay}
                onPrev={() => stepBy(-1)}
                onNext={() => stepBy(1)}
                onSelect={(n) => setSel(n)}
                onEnvelope={() => setInspectSpanId(hop?.ix?.id || interactionTrace?.trace.id || "")}
                branches={leaves}
                pathLeaf={pathLeaf}
                onPath={(leaf) => setPath({ intent: activeId, leaf })}
              />
            }
          />
        ) : (
          <section className="tr-canvas tr-canvas-state">
            <div className="tr-state">
              {loadError ? (
                <>
                  <div className="tr-state-title">Couldn’t load this trace</div>
                  <div className="tr-state-hint">{loadError.message || "The trace service returned an error."}</div>
                  <button
                    type="button"
                    className="tr-retry"
                    onClick={() => {
                      refetchIntent();
                      refetchIx();
                    }}
                  >
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <div className="tr-state-title">{noIntents ? "No intents yet" : loading ? "Loading trace…" : "No interactions recorded"}</div>
                  <div className="tr-state-hint">
                    {noIntents
                      ? "Traces show up here once an agent runs an intent."
                      : loading
                        ? "Fetching hops, nodes and evidence."
                        : "This intent has no hops yet. They appear here as agents communicate."}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {showInspector && model && (
          <FlowDetailBox
            ref={detailRef}
            model={model}
            intentId={activeId}
            hop={hop}
            tab={tab}
            onTab={setTab}
            onSelectHop={(n) => setSel(n)}
          />
        )}
        </div>
      </div>

      {inspectSpanId !== null && interactionTrace && (
        <TraceInspector
          trace={interactionTrace}
          openSpanId={inspectSpanId}
          onClose={() => setInspectSpanId(null)}
          rawData={envelope ?? undefined}
          interactionBySpanId={interactionBySpanId}
          noun={{ one: "interaction", many: "interactions" }}
        />
      )}
    </div>
  );
}

/** The first `max` characters, cut at a word. */
function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max).replace(/[\s.,;:]+$/, "")}…`;
}

/** "Oct 14, 2026 09:11". */
function formatWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${date} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
