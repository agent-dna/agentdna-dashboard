import { useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { authStatusLabel, authTone, type AuthEvidence } from "../../api/observability";
import { parseDestination } from "../../lib/destination";
import { useThreatByID } from "../../data/hooks";
import { authMethodLabel, sentence } from "../../lib/credFormat";
import { pad2, trunc, type TraceHop, type TraceModel } from "./traceModel";

/**
 * The selected hop in detail. Overview: the decision, who sent what to whom, a credential
 * summary and the envelope's provenance. Credential: every auth check recorded on the hop.
 * Evidence: the hop's envelope, field by field or as raw JSON.
 */

export type InspectorTab = "overview" | "credential" | "evidence";

interface Envelope {
  from?: string;
  to?: string;
  payload?: unknown;
  epoch?: number;
  status_code?: number;
  run_id?: string;
  hash?: string;
  signature?: string;
  parent_envelope?: unknown;
}

const envelopeOf = (h: TraceHop): Envelope | null =>
  h.ix?.raw && typeof h.ix.raw === "object" && !Array.isArray(h.ix.raw) ? (h.ix.raw as Envelope) : null;

/** Hashes of the envelopes this one names as parents, whatever shape they were sent in. */
function parentHashes(env: Envelope | null): string[] {
  const p = env?.parent_envelope;
  const list = Array.isArray(p) ? p : p ? [p] : [];
  return list.flatMap((x) =>
    typeof x === "string" ? [x] : x && typeof x === "object" && typeof (x as Envelope).hash === "string" ? [(x as Envelope).hash!] : [],
  );
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const copy = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1400);
  };
  return { copied, copy };
}

function CopyBtn({ text, k, c, size = 13 }: { text: string; k: string; c: ReturnType<typeof useCopy>; size?: number }) {
  const done = c.copied === k;
  return (
    <button type="button" className={`tri-copy${done ? " done" : ""}`} title="Copy" aria-label="Copy value" onClick={() => c.copy(text, k)}>
      <Icon name={done ? "check" : "copy"} size={size} />
    </button>
  );
}

/** A label / value row. An empty value reads "Not reported". */
function Row({ label, value, note, mono, tone, actions }: {
  label: string;
  value?: string | null;
  note?: string;
  mono?: boolean;
  tone?: "ok" | "bad" | "warn";
  actions?: ReactNode;
}) {
  const empty = value == null || value === "";
  return (
    <div className="tri-row">
      <div className="tri-label">{label}</div>
      <div className={`tri-value${empty ? " empty" : ""}${mono && !empty ? " mono" : ""}${tone && !empty ? ` t-${tone}` : ""}`}>
        {empty ? "Not reported" : value}
        {note && <div className="tri-note">{note}</div>}
      </div>
      <div className="tri-acts">{!empty && actions}</div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="tri-sec">
    <h3>{title}</h3>
    {children}
  </div>
);

export function HopInspector({ model, hop, tab, onTab, onClose, onSelect, onLocate }: {
  model: TraceModel;
  hop: TraceHop;
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  onClose: () => void;
  onSelect: (n: number) => void;
  /** Centre the graph on a node. */
  onLocate: (id: string) => void;
}) {
  const c = useCopy();
  const { data: threat } = useThreatByID(hop.blocked ? hop.ix?.threatID : undefined);
  const env = envelopeOf(hop);
  const src = model.nodeById.get(hop.src);
  const dst = model.nodeById.get(hop.dst);
  const opTag = `${hop.protocol} · ${hop.op}`;

  const parent = parentHashes(env)[0];
  const parentHop = parent ? model.hops.find((h) => envelopeOf(h)?.hash === parent) : undefined;
  const nextCred = model.credHops.find((n) => n > hop.n) ?? model.credHops[0];

  const decision = hop.blocked
    ? {
        cls: "bad",
        icon: "alerts" as IconName,
        label: "Blocked by policy",
        policy: threat?.title ?? "",
        reason: threat?.message || threat?.description || "This hop was stopped before delivery. The incident has the details.",
      }
    : { cls: "ok", icon: "check" as IconName, label: "Allowed", policy: "", reason: "No policy violation was recorded on this hop." };

  const alerts = hop.blocked ? [threat?.title || "Policy violation on this hop"] : [];
  const credTitle = hop.cred ? `${hop.cred.label} · ${authMethodLabel(hop.checks[0]?.authMethod ?? "") || "Unknown method"}` : "";
  const first = hop.checks[0];

  return (
    <aside className="tr-insp" aria-label="Hop inspector">
      <div className="tri-head">
        <span className="tri-hopno">Hop {pad2(hop.n)}</span>
        <div className="tri-title">
          {src?.name ?? hop.src} <span className="arrow">→</span> {dst?.name ?? hop.dst}
        </div>
        <div className="tri-chips">
          <span className={`chip ${hop.blocked ? "threat" : "safe"}`}>
            <span className={`dot-status ${hop.blocked ? "threat" : "safe"}`} />
            {hop.blocked ? "Blocked" : "Allowed"}
          </span>
          <span className="tr-type">{opTag}</span>
        </div>
        <span className="tri-ts">{hop.time}</span>
        <button type="button" className="tri-close" onClick={onClose} title="Close inspector (Esc)" aria-label="Close inspector">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="tri-tabs" role="tablist">
        {(
          [
            ["overview", "Overview"],
            ["credential", "Credential"],
            ["evidence", "Evidence"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => onTab(k)}>
            {label}
            {k === "credential" && hop.cred && <span className="tri-dot" />}
          </button>
        ))}
      </div>

      <div className="tri-body">
        {tab === "overview" && (
          <div className="tri-stack">
            <div className={`tri-decision ${decision.cls}`}>
              <div className="tri-dec-top">
                <Icon name={decision.icon} size={15} />
                <span className="tri-dec-label">{decision.label}</span>
                {decision.policy && <span className="tri-dec-policy">{decision.policy}</span>}
              </div>
              <div className="tri-dec-reason">{decision.reason}</div>
            </div>

            <Section title="Interaction">
              <Row
                label="Source"
                value={src?.name}
                note={src?.did ? trunc(src.did, 14, 8) : undefined}
                actions={
                  <>
                    <button type="button" className="tri-jump" onClick={() => onLocate(hop.src)}>Locate</button>
                    {src?.did && <CopyBtn text={src.did} k={`src${hop.n}`} c={c} />}
                  </>
                }
              />
              <Row
                label="Destination"
                value={dst?.name}
                note={dst?.did ? trunc(dst.did, 14, 8) : undefined}
                actions={
                  <>
                    <button type="button" className="tri-jump" onClick={() => onLocate(hop.dst)}>Locate</button>
                    {dst?.did && <CopyBtn text={dst.did} k={`dst${hop.n}`} c={c} />}
                  </>
                }
              />
              <Row label="Operation" value={opTag} mono />
              <Row label="Timestamp" value={hop.time} mono />
              <Row label="Status code" value={env?.status_code != null ? String(env.status_code) : ""} mono />
              <Row label="Interaction" value={hop.ix ? trunc(hop.ix.id, 14, 8) : ""} mono actions={hop.ix && <CopyBtn text={hop.ix.id} k={`ix${hop.n}`} c={c} />} />
            </Section>

            <Section title="Credential">
              {hop.cred && first ? (
                <button type="button" className="tri-credcard" onClick={() => onTab("credential")}>
                  <span className="tri-credic">
                    <Icon name="key" size={14} />
                  </span>
                  <span className="tri-credtxt">
                    <span className="t">{credTitle}</span>
                    <span className="s">
                      {[first.keyVersion && `key ${first.keyVersion}`, first.credentialID && `fp ${trunc(first.credentialID, 6, 4)}`, authStatusLabel(first.authStatus).toLowerCase()]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="tri-credgo">Inspect</span>
                </button>
              ) : (
                <div className="tri-none">No credential was presented on this hop.</div>
              )}
            </Section>

            <Section title="Provenance">
              <Row label="Signature" value={env?.signature ? trunc(env.signature, 12, 8) : ""} mono actions={env?.signature && <CopyBtn text={env.signature} k={`sig${hop.n}`} c={c} />} />
              <Row label="Envelope hash" value={env?.hash ? trunc(env.hash, 12, 8) : ""} mono actions={env?.hash && <CopyBtn text={env.hash} k={`h${hop.n}`} c={c} />} />
              <Row
                label="Parent"
                value={env ? (parent ? `${parentHop ? `Hop ${pad2(parentHop.n)} · ` : ""}${trunc(parent, 8, 6)}` : "None (trace root)") : ""}
                mono
                actions={parentHop && <button type="button" className="tri-jump" onClick={() => onSelect(parentHop.n)}>Go to hop</button>}
              />
            </Section>

            <Section title="Related alerts">
              {alerts.length ? (
                alerts.map((a) => (
                  <div key={a} className="tri-alert">
                    <Icon name="alerts" size={14} />
                    <span>{a}</span>
                  </div>
                ))
              ) : (
                <div className="tri-muted">No alerts linked to this hop.</div>
              )}
            </Section>
          </div>
        )}

        {tab === "credential" &&
          (hop.cred ? (
            <CredentialTab model={model} hop={hop} c={c} />
          ) : (
            <div className="tri-empty">
              <span className="tri-empty-ic">
                <Icon name="key" size={17} />
              </span>
              <div className="t">No credential on this hop</div>
              <div className="s">Hop {pad2(hop.n)} presented no credential. Hops that did are marked with a key.</div>
              {nextCred != null && (
                <button type="button" className="tri-next" onClick={() => onSelect(nextCred)}>
                  Go to next credential
                </button>
              )}
            </div>
          ))}

        {tab === "evidence" && <EvidenceTab model={model} hop={hop} env={env} c={c} onSelect={onSelect} onLocate={onLocate} />}
      </div>
    </aside>
  );
}

function CredentialTab({ model, hop, c }: { model: TraceModel; hop: TraceHop; c: ReturnType<typeof useCopy> }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const name = (did: string) => model.nodes.find((n) => n.did === did)?.name ?? trunc(did, 10, 6);
  const env = envelopeOf(hop);
  const tone = hop.cred!.tone;
  const flags = [
    { label: hop.cred!.label === "Forwarded" ? "Forwarded" : "Credential use", cls: "warn" },
    ...(tone === "bad" ? [{ label: "Rejected", cls: "bad" }] : tone === "warn" ? [{ label: "Not seen", cls: "warn" }] : []),
  ];

  return (
    <div className="tri-stack">
      <div className="tri-credhead">
        <span className="tri-credic big">
          <Icon name="key" size={15} />
        </span>
        <div className="tri-credhead-txt">
          <span className="t">Credential info</span>
          <span className="s">
            {hop.checks.length} auth check{hop.checks.length === 1 ? "" : "s"} · hop {pad2(hop.n)}
            {hop.cred!.reusedFrom ? ` · same credential as hop ${pad2(hop.cred!.reusedFrom)}` : ""}
          </span>
        </div>
        <div className="tri-flags">
          {flags.map((f) => (
            <span key={f.label} className={`tri-flag ${f.cls}`}>{f.label}</span>
          ))}
        </div>
      </div>

      {hop.checks.map((e: AuthEvidence, i) => {
        const k = `${hop.n}-${i}`;
        const t = authTone(e.authStatus);
        const dest = (e.destination || "").trim();
        const destLabel = !dest ? "" : dest.toLowerCase().startsWith("bafy") ? name(dest) : parseDestination(dest).host || dest;
        return (
          <div key={k} className="tri-check">
            {hop.checks.length > 1 && (
              <div className="tri-check-head">
                Check {i + 1} of {hop.checks.length}
                <span>{sentence(e.source)}</span>
              </div>
            )}
            <Section title="Authentication">
              <Row label="Auth status" value={authStatusLabel(e.authStatus)} tone={t} />
              <Row label="Auth method" value={authMethodLabel(e.authMethod)} />
              <Row label="Seen by" value={sentence(e.source)} />
              <Row label="Key version" value={e.keyVersion} mono actions={<CopyBtn text={e.keyVersion} k={`kv${k}`} c={c} />} />
            </Section>
            <Section title="Credential metadata">
              <Row
                label="Fingerprint"
                value={trunc(e.credentialID, 12, 8)}
                mono
                note="Credential ID · not the secret"
                actions={<CopyBtn text={e.credentialID} k={`fp${k}`} c={c} />}
              />
              <Row label="Person" value={e.identityID ? trunc(e.identityID, 12, 8) : ""} mono actions={e.identityID && <CopyBtn text={e.identityID} k={`id${k}`} c={c} />} />
              <Row
                label="Request ID"
                value={revealed[k] ? e.requestID : trunc(e.requestID, 14, 8)}
                mono
                actions={
                  <>
                    <button type="button" className="tri-reveal" onClick={() => setRevealed((r) => ({ ...r, [k]: !r[k] }))}>
                      {revealed[k] ? "Hide" : "Reveal"}
                    </button>
                    <CopyBtn text={e.requestID} k={`rq${k}`} c={c} />
                  </>
                }
              />
              <Row label="Sent to" value={destLabel} note={dest && destLabel !== dest ? trunc(dest, 18, 10) : undefined} mono actions={dest && <CopyBtn text={dest} k={`ds${k}`} c={c} />} />
              <Row label="Observed" value={e.observedAt} mono note={hop.time && e.observedAt ? offsetNote(hop.time, e.observedAt) : undefined} />
              <Row label="Run" value={e.runID} mono />
            </Section>
          </div>
        );
      })}

      <Section title="Security context">
        <Row label="Access" value={hop.blocked ? "Denied" : "Allowed"} tone={hop.blocked ? "bad" : "ok"} />
        <Row label="Envelope" value={env?.signature ? "Signed by the sender" : ""} tone="ok" />
        <Row label="Related alerts" value={hop.blocked ? "Policy violation on this hop" : "None"} tone={hop.blocked ? "bad" : undefined} />
      </Section>

      <div className="tri-foot">
        <Icon name="shield" size={14} />
        <span>Raw tokens and secrets are never stored or shown, only credential IDs and key versions. Fields marked “Not reported” weren’t sent by the trace source.</span>
      </div>
    </div>
  );
}

/** "+1s after the hop", "At hop time". */
function offsetNote(hopIso: string, atIso: string): string | undefined {
  const a = Date.parse(hopIso), b = Date.parse(atIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  const s = Math.round((b - a) / 1000);
  if (s === 0) return "At hop time";
  return `${s > 0 ? "+" : "−"}${Math.abs(s)}s ${s > 0 ? "after" : "before"} the hop`;
}

/* ---------------- Evidence ---------------- */

type EvRow = { key: string; full: string; jump?: { label: string; go: () => void } };

function flatten(o: Record<string, unknown>, prefix: string, out: [string, string][]): [string, string][] {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) flatten(v as Record<string, unknown>, key, out);
    else out.push([key, typeof v === "string" ? v : JSON.stringify(v)]);
  }
  return out;
}

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])|(\s+)|(true|false|null)/g;

function tokenize(line: string): { t: string; c: string }[] {
  const out: { t: string; c: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  JSON_TOKEN.lastIndex = 0;
  while ((m = JSON_TOKEN.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index), c: "j-p" });
    if (m[1] && m[2]) {
      out.push({ t: m[1], c: "j-k" });
      out.push({ t: m[2], c: "j-x" });
    } else if (m[1]) out.push({ t: m[1], c: /redacted/.test(m[1]) ? "j-r" : "j-s" });
    else if (m[3] || m[6]) out.push({ t: m[0], c: "j-n" });
    else if (m[4]) out.push({ t: m[4], c: "j-x" });
    else out.push({ t: m[0], c: "j-p" });
    last = JSON_TOKEN.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last), c: "j-p" });
  return out;
}

function EvidenceTab({ model, hop, env, c, onSelect, onLocate }: {
  model: TraceModel;
  hop: TraceHop;
  env: Envelope | null;
  c: ReturnType<typeof useCopy>;
  onSelect: (n: number) => void;
  onLocate: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"structured" | "raw">("structured");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const parents = useMemo(() => parentHashes(env), [env]);
  // The hop's own envelope with parents named by hash (the Envelope view has the whole chain),
  // plus the auth checks recorded for it.
  const shown = useMemo(() => {
    const base: Record<string, unknown> = env ? { ...env, parent_envelope: env.parent_envelope == null ? null : parents } : {};
    if (hop.checks.length) base.authEvidence = hop.checks;
    return base;
  }, [env, parents, hop.checks]);
  const json = JSON.stringify(shown, null, 2);
  const needle = q.trim().toLowerCase();

  const payload = env?.payload ?? hop.ix?.payload;
  let payloadRows: [string, string][];
  if (typeof payload === "string") {
    try {
      const pj: unknown = JSON.parse(payload);
      payloadRows = pj && typeof pj === "object" && !Array.isArray(pj) ? flatten(pj as Record<string, unknown>, "", []) : [["body", payload]];
    } catch {
      payloadRows = [["body", payload]];
    }
  } else if (payload && typeof payload === "object") {
    payloadRows = flatten(payload as Record<string, unknown>, "", []);
  } else payloadRows = [];

  const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
  const sections: { id: string; title: string; isCred?: boolean; rows: EvRow[] }[] = [
    {
      id: "meta",
      title: "Request metadata",
      rows: [
        { key: "from", full: str(env?.from ?? hop.ix?.initiator.id), jump: { label: "Graph", go: () => onLocate(hop.src) } },
        { key: "to", full: str(env?.to ?? hop.ix?.target.id), jump: { label: "Graph", go: () => onLocate(hop.dst) } },
        { key: "epoch", full: str(env?.epoch) },
        { key: "status_code", full: str(env?.status_code) },
        { key: "run_id", full: str(env?.run_id) },
      ],
    },
    { id: "payload", title: "Payload", rows: payloadRows.map(([key, full]) => ({ key, full })) },
    ...(hop.checks.length
      ? [
          {
            id: "cred",
            title: "Credential metadata",
            isCred: true,
            rows: hop.checks.flatMap((e, i) =>
              flatten(e as unknown as Record<string, unknown>, hop.checks.length > 1 ? `[${i}]` : "", []).map(([key, full]) => ({ key, full })),
            ),
          },
        ]
      : []),
    {
      id: "prov",
      title: "Provenance",
      rows: [
        { key: "hash", full: str(env?.hash) },
        { key: "signature", full: str(env?.signature) },
        ...parents.map((p, i) => {
          const ph = model.hops.find((h) => envelopeOf(h)?.hash === p);
          return { key: `parent_envelope[${i}]`, full: p, jump: ph ? { label: `Hop ${pad2(ph.n)}`, go: () => onSelect(ph.n) } : undefined };
        }),
      ],
    },
  ];
  const visible = sections
    .map((s) => ({ ...s, rows: needle ? s.rows.filter((r) => r.key.toLowerCase().includes(needle) || r.full.toLowerCase().includes(needle)) : s.rows }))
    .filter((s) => s.rows.length);

  return (
    <div className="tri-ev">
      <div className="tri-ev-bar">
        <label className="tri-search">
          <Icon name="search" size={13} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search evidence" aria-label="Search evidence" />
        </label>
        <div className="tri-seg">
          {(
            [
              ["structured", "Structured"],
              ["raw", "Raw JSON"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={mode === k ? "on" : ""} aria-pressed={mode === k} onClick={() => setMode(k)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className={`tri-copyjson${c.copied === `json${hop.n}` ? " done" : ""}`} title="Copy JSON" aria-label="Copy JSON" onClick={() => c.copy(json, `json${hop.n}`)}>
          <Icon name={c.copied === `json${hop.n}` ? "check" : "copy"} size={13} />
        </button>
      </div>

      {mode === "structured" ? (
        <div className="tri-ev-secs">
          {visible.map((sec) => {
            const open = needle ? true : !collapsed[sec.id];
            return (
              <div key={sec.id} className="tri-ev-sec">
                <button type="button" aria-expanded={open} onClick={() => setCollapsed((s) => ({ ...s, [sec.id]: !s[sec.id] }))}>
                  <span className={`chev${open ? " open" : ""}`}>
                    <Icon name="chevron" size={12} />
                  </span>
                  <span className="t">{sec.title}</span>
                  <span className="n">{sec.rows.length}</span>
                  {sec.isCred && (
                    <span className="k">
                      <Icon name="key" size={12} />
                    </span>
                  )}
                </button>
                {open && (
                  <div className="tri-ev-rows">
                    {sec.rows.map((r) => {
                      const long = /^[0-9a-f]{40,}$/i.test(r.full);
                      const ck = `ev${hop.n}-${sec.id}-${r.key}`;
                      return (
                        <div key={r.key} className="tri-ev-row">
                          <div className="k">{r.key}</div>
                          <div className={`v${r.full === "" ? " empty" : ""}${/redacted/.test(r.full) ? " red" : ""}`} title={r.full}>
                            {r.full === "" ? '""' : long ? trunc(r.full, 16, 10) : r.full}
                          </div>
                          <div className="a">
                            {r.jump && (
                              <button type="button" className="tri-jump sm" onClick={r.jump.go}>
                                {r.jump.label}
                              </button>
                            )}
                            <CopyBtn text={r.full} k={ck} c={c} size={12} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && <div className="tri-muted center">No fields match “{q}”.</div>}
        </div>
      ) : (
        <div className="tri-raw">
          {json.split("\n").map((ln, i) => (
            <div key={i} className={`tri-raw-ln${needle && ln.toLowerCase().includes(needle) ? " hit" : ""}`}>
              <span className="num">{i + 1}</span>
              <span className="code">
                {tokenize(ln).map((sg, j) => (
                  <span key={j} className={sg.c}>
                    {sg.t}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="tri-foot plain">
        <Icon name="shield" size={13} />
        <span>
          Envelope fields as the sender signed them{hop.checks.length ? ", with the hop's auth checks" : ""}. Parent envelopes are listed by hash; open Envelope for the full chain.
        </span>
      </div>
    </div>
  );
}
