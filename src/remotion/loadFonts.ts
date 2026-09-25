import { cancelRender, continueRender, delayRender } from "remotion";

/**
 * The dashboard gets its webfonts from a <link> in index.html, which the
 * Remotion bundle does not use. Load the same families here and hold the render
 * until the faces are ready, otherwise frames get captured with fallback
 * metrics and the layout shifts between frames.
 */
const STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=block";

// document.fonts.load() needs a full font shorthand; the size is irrelevant.
const FACES = [
  '400 16px "Inter"',
  '500 16px "Inter"',
  '600 16px "Inter"',
  '700 16px "Inter"',
  '500 16px "Space Grotesk"',
  '700 16px "Space Grotesk"',
  '400 16px "JetBrains Mono"',
  '600 16px "JetBrains Mono"',
];

const handle = delayRender("Loading AgentDNA dashboard fonts");

const stylesheetReady = new Promise<void>((resolve, reject) => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET;
  link.onload = () => resolve();
  link.onerror = () => reject(new Error(`Could not load ${STYLESHEET}`));
  document.head.appendChild(link);
});

stylesheetReady
  .then(() => Promise.all(FACES.map((face) => document.fonts.load(face))))
  .then(() => continueRender(handle))
  .catch((err) => cancelRender(err));
