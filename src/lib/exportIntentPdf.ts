import jsPDF from "jspdf";
import type { Intent, Interaction, IntentParticipant } from "../types";

interface ExportArgs {
  intent: Intent;
  interactions: Interaction[];
  participants: IntentParticipant[];
}

const NAVY: [number, number, number] = [10, 34, 64];
const SLATE: [number, number, number] = [95, 115, 160];
const ACCENT: [number, number, number] = [37, 99, 235];
const THREAT: [number, number, number] = [220, 38, 38];
const LINE: [number, number, number] = [220, 230, 245];

const MARGIN_X = 40;
const PAGE_W = 595;
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

export function exportIntentPdf({ intent, interactions, participants }: ExportArgs) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - 40) {
      doc.addPage();
      y = 40;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text("Intent", MARGIN_X, y);
  y += 22;

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(intent.id, MARGIN_X, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(`Exported ${new Date().toLocaleString()}`, MARGIN_X, y);
  y += 18;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);
  y += 20;

  // Overview
  section("Overview");
  kv([
    ["Initiator", intent.initiator?.name || "—"],
    ["Runtime", intent.runtime ? `${intent.runtime}ms` : "—"],
    ["Started", intent.started != null ? `${Math.max(0, Math.floor(intent.started / 60))} h ago` : "—"],
    ["Status", intent.name || "—"],
  ]);

  // Metrics
  section("Metrics");
  const ix = intent.interactionsCount;
  const reliability =
    ix > 0 ? Math.max(0, Math.round((((ix - intent.threats) / ix) * 100) * 100) / 100) : null;
  kv([
    ["Interactions", String(ix)],
    ["Agents touched", String(intent.agentsInteracted)],
    ["Apps touched", String(intent.toolsInteracted)],
    ["Threats", String(intent.threats), intent.threats > 0 ? THREAT : NAVY],
    ["Reliability", reliability == null ? "—" : `${reliability} / 100`],
  ]);

  // Interactions
  if (interactions.length > 0) {
    section("Interactions");
    table(
      ["ID", "Initiator", "Target", "Threat", "Time"],
      [110, 130, 130, 60, 100],
      interactions.slice(0, 50).map((i) => [
        shortId(i.id),
        truncate(i.initiator.name || i.initiator.id, 22),
        truncate(i.target.name || i.target.id, 22),
        i.threat ? "true" : "false",
        relative(i.created),
      ]),
    );
    if (interactions.length > 50) {
      doc.setFontSize(9);
      doc.setTextColor(...SLATE);
      doc.text(`(showing 50 of ${interactions.length})`, MARGIN_X, y + 12);
      y += 18;
    }
  }

  // Participants
  if (participants.length > 0) {
    section("Participants");
    table(
      ["Name", "Type", "Hops", "Threats"],
      [240, 80, 60, 60],
      participants.map((p) => [
        truncate(p.entity.name || p.entity.id, 36),
        p.type,
        String(p.count),
        String(p.threats),
      ]),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const safeId = intent.id.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 16);
  doc.save(`intent-${safeId}-${stamp}.pdf`);

  function section(title: string) {
    ensureSpace(36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT);
    doc.text(title.toUpperCase(), MARGIN_X, y);
    y += 4;
    doc.setDrawColor(...LINE);
    doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);
    y += 14;
  }

  function kv(rows: Array<[string, string, [number, number, number]?]>) {
    doc.setFontSize(10);
    rows.forEach(([k, v, color]) => {
      ensureSpace(16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...SLATE);
      doc.text(k, MARGIN_X, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(color || NAVY));
      doc.text(v, MARGIN_X + 140, y);
      y += 16;
    });
    y += 8;
  }

  function table(headers: string[], widths: number[], rows: string[][]) {
    const lineHeight = 16;
    ensureSpace(lineHeight + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    let x = MARGIN_X;
    headers.forEach((h, i) => {
      doc.text(h.toUpperCase(), x, y);
      x += widths[i];
    });
    y += 6;
    doc.setDrawColor(...LINE);
    doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    rows.forEach((cells) => {
      ensureSpace(lineHeight);
      let cx = MARGIN_X;
      cells.forEach((c, i) => {
        doc.text(c, cx, y);
        cx += widths[i];
      });
      y += lineHeight;
    });
    y += 10;
  }
}

function shortId(id: string): string {
  if (!id) return "—";
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}
function truncate(s: string, n: number): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function relative(mins: number): string {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  const h = mins / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
