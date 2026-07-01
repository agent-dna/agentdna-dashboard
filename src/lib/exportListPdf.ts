import jsPDF from "jspdf";
import type { Agent, Tool } from "../types";

const NAVY: [number, number, number] = [10, 34, 64];
const SLATE: [number, number, number] = [95, 115, 160];
const ACCENT: [number, number, number] = [37, 99, 235];
const THREAT: [number, number, number] = [220, 38, 38];
const SAFE: [number, number, number] = [5, 150, 105];
const LINE: [number, number, number] = [220, 230, 245];
const WHITE: [number, number, number] = [255, 255, 255];
const ROW_BG: [number, number, number] = [244, 247, 252];

const MARGIN_X = 36;
const PAGE_W = 595;
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

function shortId(id: string, n = 14): string {
  if (!id) return "—";
  return id.length > n ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function relativeTime(mins: number): string {
  if (mins == null || mins === 0) return "—";
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  const h = mins / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function reliability(interactions: number, threats: number): string {
  if (interactions <= 0) return "—";
  return `${Math.max(0, Math.round(((interactions - threats) / interactions) * 10000) / 100)}%`;
}

export function exportAgentsListPdf(agents: Agent[], total: number) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const stamp = new Date().toISOString().slice(0, 10);
  const pw = 842; // landscape width
  const contentW = pw - MARGIN_X * 2;
  let y = 40;

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - 36) { doc.addPage(); y = 40; }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text("Agents Report", MARGIN_X, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(`Exported ${new Date().toLocaleString()}  ·  ${total} agents total (showing ${agents.length})`, MARGIN_X, y);
  y += 16;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, MARGIN_X + contentW, y);
  y += 18;

  // Column layout (landscape A4 = 842pt wide)
  const cols = [
    { label: "Agent Name",    w: 160 },
    { label: "Agent ID",      w: 130 },
    { label: "Reliability",   w: 80  },
    { label: "Interactions",  w: 90  },
    { label: "Threats",       w: 70  },
    { label: "Status",        w: 70  },
    { label: "Created",       w: 100 },
  ];

  // Table header
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN_X, y - 10, contentW, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  let x = MARGIN_X + 6;
  cols.forEach(({ label, w }) => { doc.text(label, x, y + 2); x += w; });
  y += 14;

  // Rows
  agents.forEach((a, idx) => {
    ensureSpace(18);
    if (idx % 2 === 0) {
      doc.setFillColor(...ROW_BG);
      doc.rect(MARGIN_X, y - 10, contentW, 16, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const rel = reliability(a.interactions, a.threats);
    const cells = [
      { text: a.name || "—",                   color: NAVY,  bold: true  },
      { text: shortId(a.id),                   color: SLATE, bold: false },
      { text: rel,                              color: a.interactions > 0 ? SAFE : SLATE, bold: false },
      { text: a.interactions.toLocaleString(), color: NAVY,  bold: false },
      { text: String(a.threats),               color: a.threats > 0 ? THREAT : SLATE, bold: false },
      { text: a.status || "—",                 color: SLATE, bold: false },
      { text: relativeTime(a.created),         color: SLATE, bold: false },
    ];
    let cx = MARGIN_X + 6;
    cells.forEach(({ text, color, bold }, i) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);
      doc.text(text, cx, y);
      cx += cols[i].w;
    });
    y += 16;
  });

  doc.save(`agentdna-agents-${stamp}.pdf`);
}

export function exportToolsListPdf(tools: Tool[], total: number) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const stamp = new Date().toISOString().slice(0, 10);
  const pw = 842;
  const contentW = pw - MARGIN_X * 2;
  let y = 40;

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - 36) { doc.addPage(); y = 40; }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text("Apps / Tools Report", MARGIN_X, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(`Exported ${new Date().toLocaleString()}  ·  ${total} apps total (showing ${tools.length})`, MARGIN_X, y);
  y += 16;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, MARGIN_X + contentW, y);
  y += 18;

  const cols = [
    { label: "App Name",     w: 160 },
    { label: "App ID",       w: 140 },
    { label: "Scope",        w: 110 },
    { label: "Provider",     w: 100 },
    { label: "Reliability",  w: 80  },
    { label: "Interactions", w: 90  },
    { label: "Threats",      w: 70  },
  ];

  // Table header
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_X, y - 10, contentW, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  let x = MARGIN_X + 6;
  cols.forEach(({ label, w }) => { doc.text(label, x, y + 2); x += w; });
  y += 14;

  tools.forEach((t, idx) => {
    ensureSpace(18);
    if (idx % 2 === 0) {
      doc.setFillColor(...ROW_BG);
      doc.rect(MARGIN_X, y - 10, contentW, 16, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const rel = reliability(t.interactions, t.threats);
    const cells = [
      { text: t.name || "—",                   color: NAVY,  bold: true  },
      { text: shortId(t.id),                   color: SLATE, bold: false },
      { text: t.scope || "—",                  color: SLATE, bold: false },
      { text: t.provider || "—",               color: SLATE, bold: false },
      { text: rel,                              color: t.interactions > 0 ? SAFE : SLATE, bold: false },
      { text: t.interactions.toLocaleString(), color: NAVY,  bold: false },
      { text: String(t.threats),               color: t.threats > 0 ? THREAT : SLATE, bold: false },
    ];
    let cx = MARGIN_X + 6;
    cells.forEach(({ text, color, bold }, i) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);
      doc.text(text, cx, y);
      cx += cols[i].w;
    });
    y += 16;
  });

  doc.save(`agentdna-apps-${stamp}.pdf`);
}
