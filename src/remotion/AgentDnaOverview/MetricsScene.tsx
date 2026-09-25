import type { FC } from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const MetricsScene: FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Metrics scene"
      style={{
        background: "var(--bg-0)",
        padding: 140,
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        opacity: interpolate(frame, [0, 0.4 * fps, durationInFrames - 0.4 * fps, durationInFrames], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.linear, Easing.linear],
        }),
      }}
    >
      <Interactive.Div
        name="Section label"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "0.14em",
          color: "var(--fg-muted)",
          marginBottom: 20,
          opacity: interpolate(frame, [0, 0.7 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        LAST 30 DAYS
      </Interactive.Div>

      <Interactive.Div
        name="Section title"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 86,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "var(--fg)",
          marginBottom: 72,
          opacity: interpolate(frame, [0.1 * fps, 0.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [0.1 * fps, 0.9 * fps], ["0px 28px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Your whole agent estate, at a glance
      </Interactive.Div>

      <Interactive.Div name="Metric row" style={{ display: "flex", gap: 32 }}>
        <Interactive.Div
          name="Total agents tile"
          style={{
            flex: 1,
            padding: 40,
            borderRadius: 18,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            boxShadow: "0 18px 40px rgba(15, 32, 70, 0.07)",
            opacity: interpolate(frame, [0.3 * fps, 1 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [0.3 * fps, 1 * fps], ["0px 48px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 18 }}>Total Agents</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 104,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "var(--fg)",
            }}
          >
            {Math.round(
              interpolate(frame, [0.4 * fps, 1.9 * fps], [0, 128], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            )}
          </div>
          <div
            style={{
              height: 8,
              marginTop: 28,
              borderRadius: 999,
              background: "var(--accent)",
              width: interpolate(frame, [0.5 * fps, 2 * fps], ["0%", "82%"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          />
        </Interactive.Div>

        <Interactive.Div
          name="Total apps tile"
          style={{
            flex: 1,
            padding: 40,
            borderRadius: 18,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            boxShadow: "0 18px 40px rgba(15, 32, 70, 0.07)",
            opacity: interpolate(frame, [0.45 * fps, 1.15 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [0.45 * fps, 1.15 * fps], ["0px 48px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 18 }}>Total Apps</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 104,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "var(--fg)",
            }}
          >
            {Math.round(
              interpolate(frame, [0.55 * fps, 2.05 * fps], [0, 42], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            )}
          </div>
          <div
            style={{
              height: 8,
              marginTop: 28,
              borderRadius: 999,
              background: "var(--accent-2)",
              width: interpolate(frame, [0.65 * fps, 2.15 * fps], ["0%", "54%"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          />
        </Interactive.Div>

        <Interactive.Div
          name="Reliability tile"
          style={{
            flex: 1,
            padding: 40,
            borderRadius: 18,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            boxShadow: "0 18px 40px rgba(15, 32, 70, 0.07)",
            opacity: interpolate(frame, [0.6 * fps, 1.3 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [0.6 * fps, 1.3 * fps], ["0px 48px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 18 }}>
            Avg. Reliability
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 104,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "var(--safe)",
            }}
          >
            {interpolate(frame, [0.7 * fps, 2.2 * fps], [0, 97.4], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }).toFixed(1)}
            <span style={{ fontSize: 56, color: "var(--fg-muted)" }}>%</span>
          </div>
          <div
            style={{
              height: 8,
              marginTop: 28,
              borderRadius: 999,
              background: "var(--safe)",
              width: interpolate(frame, [0.8 * fps, 2.3 * fps], ["0%", "97%"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          />
        </Interactive.Div>

        <Interactive.Div
          name="Threats tile"
          style={{
            flex: 1,
            padding: 40,
            borderRadius: 18,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            boxShadow: "0 18px 40px rgba(15, 32, 70, 0.07)",
            opacity: interpolate(frame, [0.75 * fps, 1.45 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [0.75 * fps, 1.45 * fps], ["0px 48px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 18 }}>
            Threats Flagged
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 104,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "var(--threat)",
            }}
          >
            {Math.round(
              interpolate(frame, [0.85 * fps, 2.35 * fps], [0, 18], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            )}
          </div>
          <div
            style={{
              height: 8,
              marginTop: 28,
              borderRadius: 999,
              background: "var(--threat)",
              width: interpolate(frame, [0.95 * fps, 2.45 * fps], ["0%", "22%"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          />
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
