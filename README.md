# AgentDNA Dashboard Portal

The AgentDNA Dashboard Portal is a web-based monitoring and analytics interface for visualizing, inspecting, and understanding the behavior of autonomous agents.
It provides visibility into agent interactions, communication history, and runtime activity across your agent network.

## Local development

Clone the repo and install dependencies:
```bash
npm install
```

Start the dev server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

## Docker

All commands run from the **project root** (`agentdna-dashboard/`).

### Build the image

```bash
docker build -t agentdna-dashboard -f docker/Dockerfile .
```

### Run the container

Pass environment variables at runtime with `-e`:

```bash
docker run -p 80:80 \
  -e VITE_API_BASE_URL=http://your-backend-ip:9000/dashboard/v1/ \
  -e VITE_ADMIN_API_BASE_URL=http://your-backend-ip:8001/agent-admin/v1 \
  -e VITE_DUMMY=false \
  agentdna-dashboard
```

The app will be available at `http://localhost`.

Map to a different host port if needed (e.g. `-p 3000:80`).

### Environment variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | Base URL of the main backend API | `http://your-backend-ip:9000/dashboard/v1/` |
| `VITE_ADMIN_API_BASE_URL` | Yes | Base URL for admin API endpoints | `http://your-backend-ip:8001/agent-admin/v1` |
| `VITE_DUMMY` | No | Set to `true` to run with mock data (no backend needed) | `false` |

> **Note for Mac/Windows:** If the backend runs on the same machine as Docker, use `host.docker.internal` instead of `localhost` as the IP. On Linux, use the host's LAN IP address.

### How runtime env vars work

Environment variables are injected at container startup — you build the image once and configure it at runtime. There is no need to rebuild the image to change the backend URL.

The `docker/entrypoint.sh` script generates a `/env-config.js` file from the env vars you pass at `docker run` time, and the app reads those values before making any API calls.
