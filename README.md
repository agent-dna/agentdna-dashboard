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

Build the image (no env vars needed at build time):
```bash
docker build -t agentdna-dashboard .
```

Run the container — pass environment variables at runtime:
```bash
docker run -p 80:80 \
  -e VITE_API_BASE_URL=https://api.agentdna.io \
  -e VITE_ADMIN_API_BASE_URL=https://api.agentdna.io \
  -e VITE_DUMMY=false \
  agentdna-dashboard
```

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API | `https://api.agentdna.io` |
| `VITE_ADMIN_API_BASE_URL` | Base URL for admin API endpoints | `https://api.agentdna.io` |
| `VITE_DUMMY` | Set to `true` to run with mock data (no backend needed) | `false` |

The app is served on port `80` inside the container. Map it to any host port you like (e.g. `-p 3000:80`).
