import type { FC } from "react";
import { Composition, Folder } from "remotion";
import { AgentDnaOverview } from "./AgentDnaOverview/AgentDnaOverview";
import { ClosingScene } from "./AgentDnaOverview/ClosingScene";
import { MetricsScene } from "./AgentDnaOverview/MetricsScene";
import { TitleScene } from "./AgentDnaOverview/TitleScene";
import { TopAgentsScene } from "./AgentDnaOverview/TopAgentsScene";

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="AgentDnaOverview"
        component={AgentDnaOverview}
        durationInFrames={534}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="AgentDnaOverview-Scenes">
        <Composition id="Title" component={TitleScene} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Metrics" component={MetricsScene} durationInFrames={150} fps={30} width={1920} height={1080} />
        <Composition
          id="TopAgents"
          component={TopAgentsScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition id="Closing" component={ClosingScene} durationInFrames={120} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
