import type { FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ClosingScene } from "./ClosingScene";
import { MetricsScene } from "./MetricsScene";
import { TitleScene } from "./TitleScene";
import { TopAgentsScene } from "./TopAgentsScene";

/**
 * Four scenes at 30fps, each one fading itself in and out. The sequences overlap
 * by 12 frames so the fades cross rather than dipping through the backdrop.
 */
export const AgentDnaOverview: FC = () => {
  return (
    <AbsoluteFill name="AgentDNA overview" style={{ backgroundColor: "#071026" }}>
      <Sequence name="Title" from={0} durationInFrames={120}>
        <TitleScene />
      </Sequence>
      <Sequence name="Metrics" from={108} durationInFrames={150}>
        <MetricsScene />
      </Sequence>
      <Sequence name="Top agents" from={246} durationInFrames={180}>
        <TopAgentsScene />
      </Sequence>
      <Sequence name="Closing" from={414} durationInFrames={120}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
