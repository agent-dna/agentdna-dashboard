import jsPDF from "jspdf";
import type { Agent, Interaction, Intent } from "../types";
import type { PolicyHistoryEntry } from "../api/policy";

interface ExportArgs {
  agent: Agent;
  interactions: Interaction[];
  intents: Intent[];
  history: PolicyHistoryEntry[];
}

const NAVY: [number, number, number] = [10, 34, 64];
const SLATE: [number, number, number] = [95, 115, 160];
const ACCENT: [number, number, number] = [37, 99, 235];
const THREAT: [number, number, number] = [220, 38, 38];
const LINE: [number, number, number] = [220, 230, 245];

const MARGIN_X = 40;
const PAGE_W = 595; // A4 in pt (default jsPDF unit)
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

export function exportAgentPdf({ agent, interactions, intents, history }: ExportArgs) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - 40) {
      doc.addPage();
      y = 40;
    }
  };

  // ----- Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text(agent.name, MARGIN_X, y);
  y += 22;

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(agent.id, MARGIN_X, y);
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

  // ----- Overview
  section("Overview");
  kv([
    ["Owner", agent.owner || "—"],
    ["Environment", agent.env || "—"],
    ["Created", agent.created != null ? `${Math.max(0, Math.floor(agent.created / 60))} hours ago` : "—"],
    ["Connected", String(agent.connected ?? 0)],
  ]);

  // ----- Metrics
  section("Metrics");
  const reliability =
    agent.interactions > 0
      ? Math.max(0, Math.round((((agent.interactions - agent.threats) / agent.interactions) * 100) * 100) / 100)
      : null;
  kv([
    ["Reliability", reliability == null ? "—" : `${reliability} / 100`],
    ["Interactions", agent.interactions.toLocaleString()],
    ["Threats", String(agent.threats), agent.threats > 0 ? THREAT : NAVY],
    ["Intents handled", String(intents.length)],
  ]);

  // ----- Interactions
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

  // ----- Intents
  if (intents.length > 0) {
    section("Intents");
    table(
      ["Intent ID", "Threats", "Started", "Score"],
      [220, 60, 100, 60],
      intents.slice(0, 50).map((i) => [
        shortId(i.id),
        String(i.threats),
        relative(i.started),
        i.score != null ? String(i.score) : "—",
      ]),
    );
  }

  // ----- Policy history
  if (history.length > 0) {
    section("Policy history");
    const sortedAsc = [...history].sort((a, b) => a.time - b.time);
    table(
      ["#", "Update ID", "Time"],
      [40, 220, 180],
      sortedAsc.map((h, i) => [
        String(i + 1),
        shortId(h.updateID),
        new Date(h.time * 1000).toLocaleString(),
      ]),
    );
  }

  const safeName = agent.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`agent-${safeName}-${stamp}.pdf`);

  // ----- helpers (closed over `doc` and `y`) -----
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
    // header
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
