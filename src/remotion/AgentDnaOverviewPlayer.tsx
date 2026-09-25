import type { FC } from "react";
import { Player } from "@remotion/player";
import { AgentDnaOverview } from "./AgentDnaOverview/AgentDnaOverview";

interface AgentDnaOverviewPlayerProps {
  /** Show the play/scrub bar. Off by default so it reads as motion graphic, not video. */
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
}

/**
 * Embeds the AgentDNA overview as a live motion graphic instead of a rendered
 * file — the same components the `video:render` script uses, drawn by React in
 * the browser, so it stays crisp at any size and picks up the dashboard's CSS
 * variables from the app's own stylesheet (no video.css import needed here).
 */
export const AgentDnaOverviewPlayer: FC<AgentDnaOverviewPlayerProps> = ({
  controls = false,
  autoPlay = true,
  loop = true,
}) => {
  return (
    <Player
      component={AgentDnaOverview}
      durationInFrames={534}
      fps={30}
      compositionWidth={1920}
      compositionHeight={1080}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      style={{ width: "100%", borderRadius: 14, overflow: "hidden" }}
    />
  );
};
