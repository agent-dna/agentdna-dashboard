import type { FC } from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const ClosingScene: FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Closing scene"
      style={{
        background: "linear-gradient(135deg, #0A2240 0%, #0B1633 55%, #071026 100%)",
        padding: 140,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        fontFamily: "var(--font-body)",
        opacity: interpolate(frame, [0, 0.4 * fps, durationInFrames - 0.6 * fps, durationInFrames], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.linear, Easing.linear],
        }),
      }}
    >
      <Interactive.Div
        name="Closing headline"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 118,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          color: "#FFFFFF",
          maxWidth: 1480,
          opacity: interpolate(frame, [0.2 * fps, 1.1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [0.2 * fps, 1.4 * fps], [0.94, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
        }}
      >
        See every interaction. Trust every agent.
      </Interactive.Div>

      <Interactive.Div
        name="Closing wordmark"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 40,
          fontWeight: 600,
          letterSpacing: "0.34em",
          color: "#5F83E8",
          marginTop: 64,
          opacity: interpolate(frame, [1 * fps, 2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [1 * fps, 2 * fps], ["0px 24px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        AGENTDNA
      </Interactive.Div>
    </AbsoluteFill>
  );
};
