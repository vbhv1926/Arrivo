#!/bin/bash
# Double-click this on a Mac to run Arrivo.
# It starts the server and opens http://localhost:8787 in your browser.
# Close this window (or press Ctrl+C) to stop it.

cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8787}"
URL="http://localhost:$PORT"

pause() {
  echo
  read -n 1 -s -r -p "Press any key to close this window."
  echo
}

open_site() {
  if command -v open >/dev/null 2>&1; then
    open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1
  else
    echo "Open $URL in your browser."
  fi
}

echo
echo "  arrivo."
echo "  ------"
echo

# already running? then just open it
if curl -s -o /dev/null --max-time 2 "$URL/api/health"; then
  echo "Arrivo is already running. Opening $URL"
  open_site
  exit 0
fi

# find python 3.8+
PY=""
for p in python3 python; do
  if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
    PY="$p"
    break
  fi
done

if [ -z "$PY" ]; then
  echo "Arrivo needs Python 3.8 or newer, and it isn't installed."
  echo "Get it from https://www.python.org/downloads/ then double-click start.command again."
  echo "(On a Mac you can also run:  xcode-select --install )"
  pause
  exit 1
fi

# the site has to be built once. it comes built from GitHub, so this only
# runs if frontend/dist is missing, and needs Node.js for that one time
if [ ! -f frontend/dist/index.html ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "Building the site (first run only)..."
    (cd frontend && npm install && npm run build) || {
      echo "The build failed. See the messages above."
      pause
      exit 1
    }
  else
    echo "frontend/dist is missing and Node.js isn't installed to build it."
    echo "Install Node from https://nodejs.org or download the repo again."
    pause
    exit 1
  fi
fi

# open the browser as soon as the server answers
(
  for i in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 1 "$URL/api/health"; then
      open_site
      exit 0
    fi
    sleep 0.5
  done
) &

echo "Starting Arrivo on $URL  (Ctrl+C or close this window to stop)"
echo
"$PY" backend/server.py --port "$PORT"
pause
