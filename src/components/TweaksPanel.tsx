import { useState } from "react";
import {
  FONT_OPTIONS,
  useTweaks,
  type ChartStyle,
  type Density,
  type FontFamily,
  type SidebarMode,
} from "../context/TweaksContext";

const PANEL_CSS = `
  .twk-fab {
    position: fixed; right: 16px; bottom: 16px; z-index: 60;
    height: 36px; padding: 0 14px;
    background: var(--bg-1); color: var(--fg);
    border: 1px solid var(--line-strong); border-radius: 999px;
    font: 500 12.5px var(--font-body);
    box-shadow: 0 4px 16px rgba(15,32,70,0.10);
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .twk-fab:hover { background: var(--bg-2); }
  .twk-panel {
    position: fixed; right: 16px; bottom: 60px; z-index: 60;
    width: 280px;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    box-shadow: 0 16px 48px rgba(15,32,70,0.18);
    padding: 14px;
    font: 13px var(--font-body); color: var(--fg);
  }
  .twk-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .twk-hd b { font: 600 13px var(--font-display); }
  .twk-x { width: 24px; height: 24px; border: 0; background: transparent; color: var(--fg-muted); cursor: pointer; border-radius: 6px; }
  .twk-x:hover { background: var(--bg-2); color: var(--fg); }
  .twk-sect { font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); margin: 12px 0 6px; }
  .twk-sect:first-child { margin-top: 0; }
  .twk-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
  .twk-row label { font-size: 12px; color: var(--fg-dim); }
  .twk-seg { display: flex; background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px; padding: 3px; gap: 2px; }
  .twk-seg button { flex: 1; background: transparent; border: 0; color: var(--fg-muted); font: 500 12px var(--font-body); padding: 5px 8px; border-radius: 6px; cursor: pointer; }
  .twk-seg button.on { background: var(--bg-1); color: var(--fg); box-shadow: 0 1px 2px rgba(15,32,70,0.06); }
  .twk-font-list { display: flex; flex-direction: column; gap: 4px; }
  .twk-font-btn {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    border: 1px solid var(--line);
    background: var(--bg-1);
    border-radius: 8px;
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--fg);
    transition: border-color 120ms, background 120ms;
  }
  .twk-font-btn:hover { border-color: var(--line-strong); background: var(--bg-2); }
  .twk-font-btn.on { border-color: var(--accent); background: rgba(37,99,235,0.06); color: var(--accent); }
  .twk-font-btn .check { font-size: 12px; color: var(--accent); opacity: 0; }
  .twk-font-btn.on .check { opacity: 1; }
`;

interface SegProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}
function Seg<T extends string>({ value, options, onChange }: SegProps<T>) {
  return (
    <div className="twk-seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TweaksPanel() {
  const { tweaks, setTweak } = useTweaks();
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{PANEL_CSS}</style>
      {!open && (
        <button className="twk-fab" onClick={() => setOpen(true)} title="Tweaks">
          ⚙ Tweaks
        </button>
      )}
      {open && (
        <div className="twk-panel">
          <div className="twk-hd">
            <b>Tweaks</b>
            <button className="twk-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          <div className="twk-sect">Layout</div>
          <div className="twk-row">
            <label>Sidebar</label>
            <Seg<SidebarMode>
              value={tweaks.sidebar}
              onChange={(v) => setTweak("sidebar", v)}
              options={[
                { value: "expanded", label: "Expanded" },
                { value: "collapsed", label: "Collapsed" },
              ]}
            />
          </div>
          <div className="twk-row">
            <label>Table density</label>
            <Seg<Density>
              value={tweaks.density}
              onChange={(v) => setTweak("density", v)}
              options={[
                { value: "compact", label: "Compact" },
                { value: "comfortable", label: "Comfy" },
                { value: "spacious", label: "Spacious" },
              ]}
            />
          </div>

          <div className="twk-sect">Typography</div>
          <div className="twk-row">
            <label>Body font</label>
            <div className="twk-font-list">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`twk-font-btn ${tweaks.font === f.value ? "on" : ""}`}
                  onClick={() => setTweak("font", f.value as FontFamily)}
                  style={{ fontFamily: `"${f.value}", system-ui, sans-serif` }}
                >
                  <span>{f.label}</span>
                  <span className="check">✓</span>
                </button>
              ))}
            </div>
          </div>

          <div className="twk-sect">Charts</div>
          <div className="twk-row">
            <label>Chart style</label>
            <Seg<ChartStyle>
              value={tweaks.chartStyle}
              onChange={(v) => setTweak("chartStyle", v)}
              options={[
                { value: "area", label: "Area" },
                { value: "line", label: "Line" },
                { value: "bar", label: "Bars" },
              ]}
            />
          </div>
        </div>
      )}
    </>
  );
}
