import type { FC } from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const TitleScene: FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Title scene"
      style={{
        background: "linear-gradient(135deg, #0A2240 0%, #0B1633 55%, #071026 100%)",
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
        name="Eyebrow"
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 14,
          padding: "12px 24px",
          borderRadius: 999,
          background: "rgba(37, 99, 235, 0.16)",
          border: "1px solid rgba(37, 99, 235, 0.45)",
          color: "#A8BDF5",
          fontFamily: "var(--font-mono)",
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "0.14em",
          marginBottom: 44,
          opacity: interpolate(frame, [0.2 * fps, 1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [0.2 * fps, 1 * fps], ["0px 28px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        AGENTDNA
      </Interactive.Div>

      <Interactive.Div
        name="Headline"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 132,
          fontWeight: 700,
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          color: "#FFFFFF",
          maxWidth: 1420,
          opacity: interpolate(frame, [0.5 * fps, 1.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [0.5 * fps, 1.4 * fps], ["0px 40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Mission control for every agent you run
      </Interactive.Div>

      <Interactive.Div
        name="Subtitle"
        style={{
          fontSize: 46,
          fontWeight: 500,
          lineHeight: 1.35,
          color: "rgba(255, 255, 255, 0.62)",
          maxWidth: 1180,
          marginTop: 40,
          opacity: interpolate(frame, [0.9 * fps, 1.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [0.9 * fps, 1.9 * fps], ["0px 32px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Identity-verified actors, the apps they invoke, and the reliability of every interaction.
      </Interactive.Div>

      <Interactive.Div
        name="Accent rule"
        style={{
          height: 8,
          borderRadius: 999,
          marginTop: 64,
          background: "linear-gradient(90deg, #2563EB, #0EA5E9 60%, rgba(14, 165, 233, 0))",
          width: interpolate(frame, [1.2 * fps, 2.6 * fps], ["0px", "760px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />
    </AbsoluteFill>
  );
};
