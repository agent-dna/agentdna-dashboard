import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  plugins: [react()],

  server: {
    port: parseInt(process.env.DASHBOARD_SERVER_PORT!, 10) || 2345,      // change port
    host: true,      // allow access from network (0.0.0.0)
    strictPort: true, // prevents auto-switching if port is busy
  }
})