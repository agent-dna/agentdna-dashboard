import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {

    port: Number(process.env.VITE_PORT) || 4009,
    host: true,
    strictPort: true,
    allowedHosts: [
      "dashboard-dev.agentdna.io",
      "dashboard.agentdna.io",
    ],
  },
});