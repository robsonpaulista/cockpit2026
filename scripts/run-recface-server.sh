#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/python/recface"

RECFACE_HOST="${RECFACE_HOST:-127.0.0.1}"
RECFACE_PORT="${RECFACE_PORT:-8502}"

if [[ ! -d venv ]]; then
  python3 -m venv venv
fi

# shellcheck disable=SC1091
source venv/bin/activate

if [[ "${RECFACE_SKIP_PIP:-}" != "1" ]]; then
  python -m pip install -q -U pip
  python -m pip install -q -r requirements-cockpit.txt
fi

echo "Recface em http://${RECFACE_HOST}:${RECFACE_PORT}"
exec python -m uvicorn server:app --host "$RECFACE_HOST" --port "$RECFACE_PORT"
