// Config for the `video` / `video:render` scripts. Vite never reads this file,
// and Remotion never reads vite.config.ts — the two builds stay independent.
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/remotion/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setOutputLocation("out/agentdna-overview.mp4");
Config.setOverwriteOutput(true);
