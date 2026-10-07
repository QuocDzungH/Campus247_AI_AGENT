#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# Tries python3 → python → py -3 on PATH; on Windows, falls back to common
# Python install locations because Git Bash launched by some hooks gets a
# stripped PATH that omits the Windows Python directory.
# Designed to be sourced or called as: bash scripts/_pyrun.sh <script> [args...]
#
# Exits 0 silently if no Python is found — hooks must never block the AI tool.
set -u

# Prefer the project's virtual environment. Besides matching the application
# runtime, this ensures hook-only dependencies such as python-dotenv are
# available when Git invokes the hook with a minimal PATH.
if [ -x ".venv/Scripts/python.exe" ]; then
  exec ".venv/Scripts/python.exe" "$@"
elif [ -x ".venv/bin/python" ]; then
  exec ".venv/bin/python" "$@"
fi

case "$(uname -s 2>/dev/null || true)" in
  MINGW*|MSYS*|CYGWIN*)
    # On Windows, python/python3 may be Microsoft Store aliases that exist on
    # PATH but cannot run. Prefer the real Python Launcher used by Git Bash.
    if command -v py >/dev/null 2>&1; then
      PY="py -3"
    elif command -v python3 >/dev/null 2>&1; then
      PY=python3
    elif command -v python >/dev/null 2>&1; then
      PY=python
    else
      PY=""
    fi
    ;;
  *)
    if command -v python3 >/dev/null 2>&1; then
      PY=python3
    elif command -v python >/dev/null 2>&1; then
      PY=python
    elif command -v py >/dev/null 2>&1; then
      PY="py -3"
    else
      PY=""
    fi
    ;;
esac

if [ -z "$PY" ]; then
  # PATH lookup failed — probe standard Windows install locations.
  shopt -s nullglob 2>/dev/null || true
  for cand in \
    /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
    "/c/Program Files/Python"*/python.exe \
    "/c/Program Files (x86)/Python"*/python.exe \
    /c/Python*/python.exe; do
    if [ -x "$cand" ]; then PY="$cand"; break; fi
  done
  shopt -u nullglob 2>/dev/null || true
  [ -n "$PY" ] || exit 0
fi

# shellcheck disable=SC2086
exec $PY "$@"
