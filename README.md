# AgentDNA Dashboard Portal

The AgentDNA Dashboard Portal is a web-based monitoring and analytics interface designed to visualize, inspect, and understand the behavior of autonomous agents in a system.
It provides deep visibility into agent interactions, communication history, and runtime injections that occur while agents communicate with each other or with external applications.

Clone the repo
Install the dependencies 
```npm i ```

Run in the dev mode 
```npm run dev```

For build 
```npm run build```

## Docker

Run all commands from the **project root** (`agentdna-dashboard/`).

Build the image:
```bash
docker build -t agentdna-dashboard -f docker/Dockerfile .
```

Run the container — pass environment variables at runtime:
```bash
docker run -p 80:80 \
  -e VITE_API_BASE_URL=http://your-backend-ip:9000/dashboard/v1/ \
  -e VITE_ADMIN_API_BASE_URL=http://your-backend-ip:8001/agent-admin/v1 \
  -e VITE_DUMMY=false \
  agentdna-dashboard
```

The app will be available at `http://localhost`.

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API | `http://your-backend-ip:9000/dashboard/v1/` |
| `VITE_ADMIN_API_BASE_URL` | Base URL for admin API endpoints | `http://your-backend-ip:8001/agent-admin/v1` |
| `VITE_DUMMY` | Set to `true` to run with mock data (no backend needed) | `false` |

> **Note:** Replace `your-backend-ip` with your server's actual IP address. If running the backend on the same machine, use `host.docker.internal` (Mac/Windows) or the host's LAN IP (Linux).

The app is served on port `80` inside the container. Map it to any host port you like (e.g. `-p 3000:80`).
