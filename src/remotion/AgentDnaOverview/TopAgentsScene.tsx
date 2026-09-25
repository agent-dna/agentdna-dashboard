import type { FC } from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Stand-in for the `topAgents` ranking the dashboard gets from
 * /agents-apps-metrics — swap in real numbers before publishing the video.
 */
const TOP_AGENTS = [
  { name: "Atlas Research", interactions: 48210, threats: 0 },
  { name: "Ledger Reconciler", interactions: 31860, threats: 3 },
  { name: "Support Triage Bot", interactions: 24475, threats: 1 },
  { name: "Contract Reviewer", interactions: 18930, threats: 6 },
  { name: "Onboarding Copilot", interactions: 12640, threats: 0 },
];

export const TopAgentsScene: FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Top agents scene"
      style={{
        background: "var(--bg-0)",
        padding: "90px 140px",
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
        RANKED BY INTERACTIONS
      </Interactive.Div>

      <Interactive.Div
        name="Section title"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 74,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "var(--fg)",
          marginBottom: 44,
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
        Top agents by volume
      </Interactive.Div>

      <Interactive.Div
        name="Leaderboard"
        style={{
          borderRadius: 20,
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          boxShadow: "0 24px 60px rgba(15, 32, 70, 0.08)",
          overflow: "hidden",
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr 300px 200px",
            alignItems: "center",
            padding: "26px 44px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "var(--fg-muted)",
          }}
        >
          <div>#</div>
          <div>AGENT</div>
          <div style={{ textAlign: "right" }}>INTERACTIONS</div>
          <div style={{ textAlign: "right" }}>THREATS</div>
        </div>

        {TOP_AGENTS.map((agent, i) => (
          <div
            key={agent.name}
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 300px 200px",
              alignItems: "center",
              padding: "20px 44px",
              borderBottom: i === TOP_AGENTS.length - 1 ? "none" : "1px solid var(--line)",
              background: i === 0 ? "var(--bg-2)" : "transparent",
              opacity: interpolate(frame, [0.6 * fps + i * 7, 1.3 * fps + i * 7], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: interpolate(frame, [0.6 * fps + i * 7, 1.3 * fps + i * 7], ["-40px 0px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 26,
                fontWeight: 600,
                background: i === 0 ? "var(--accent-2)" : "var(--bg-3)",
                color: i === 0 ? "#FFFFFF" : "var(--fg-muted)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ paddingRight: 48 }}>
              <div style={{ fontSize: 36, fontWeight: 600, color: "var(--fg)", marginBottom: 12 }}>{agent.name}</div>
              <div style={{ height: 10, borderRadius: 999, background: "var(--bg-3)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, var(--accent-2), var(--accent))",
                    width: `${interpolate(frame, [0.8 * fps + i * 7, 2.4 * fps + i * 7], [0, (agent.interactions / TOP_AGENTS[0].interactions) * 100], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.bezier(0.16, 1, 0.3, 1),
                    })}%`,
                  }}
                />
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontSize: 44,
                fontWeight: 600,
                color: "var(--fg)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(
                interpolate(frame, [0.8 * fps + i * 7, 2.4 * fps + i * 7], [0, agent.interactions], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
              ).toLocaleString("en-US")}
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-block",
                  minWidth: 84,
                  padding: "10px 20px",
                  borderRadius: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 32,
                  fontWeight: 600,
                  background: agent.threats > 0 ? "rgba(220, 38, 38, 0.1)" : "var(--bg-3)",
                  color: agent.threats > 0 ? "var(--threat)" : "var(--fg-muted)",
                }}
              >
                {agent.threats}
              </span>
            </div>
          </div>
        ))}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
