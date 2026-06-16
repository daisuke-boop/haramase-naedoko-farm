#!/bin/zsh
set -e

cd "$(dirname "$0")"

PORT=4173

echo "========================================"
echo " Farm preview restart"
echo "========================================"
echo ""
echo "Project: $(pwd)"
echo "Port:    ${PORT}"
echo ""

existing_pids=$(lsof -tiTCP:${PORT} -sTCP:LISTEN || true)

if [[ -n "${existing_pids}" ]]; then
  echo "Stopping existing preview server..."
  echo "${existing_pids}" | while read -r pid; do
    if [[ -n "${pid}" ]]; then
      kill "${pid}" || true
      echo "  stopped PID ${pid}"
    fi
  done
  sleep 1
else
  echo "No existing preview server found."
fi

echo ""
echo "Building and starting preview server..."
echo "Open: http://localhost:${PORT}/"
echo ""

npm run preview &
server_pid=$!

echo "Waiting for preview server..."
for i in {1..60}; do
  if curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
    echo "Preview server is ready."
    open "http://localhost:${PORT}/"
    sleep 1
    osascript <<'APPLESCRIPT' >/dev/null 2>&1 || true
tell application "Google Chrome"
  activate
  if (count of windows) > 0 then
    set bounds of front window to {80, 40, 1440, 940}
  end if
end tell
APPLESCRIPT
    break
  fi
  sleep 1
done

wait "${server_pid}"
