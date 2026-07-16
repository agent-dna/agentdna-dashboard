#!/bin/sh
set -e

cat > /usr/share/nginx/html/env-config.js <<EOF
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_ADMIN_API_BASE_URL: "${VITE_ADMIN_API_BASE_URL:-}",
  VITE_DUMMY: "${VITE_DUMMY:-false}"
};
EOF

exec nginx -g "daemon off;"
