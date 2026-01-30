import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 4003,
    host: true,
    strictPort: true,
    allowedHosts: [
      "dashboard-dev.agentdna.io",
    ],
  },
});