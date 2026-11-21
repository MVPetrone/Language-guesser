#!/usr/bin/env bash
# Parallel edge-tts fill for missing clips. Emits jobs with scripts/audio_jobs.mts,
# then runs N edge-tts processes at once. Afterwards run `node scripts/generate_audio.mts`
# once to rebuild the manifest (it skips clips that already exist).
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
JOBS="${1:-6}"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

node scripts/audio_jobs.mts > "$TMP"
TOTAL=$(wc -l < "$TMP")
echo "clips to generate: $TOTAL (parallel=$JOBS)"

one() {
  local locale="$1" vi="$2" voice="$3" sid="$4" b64="$5"
  local out="$ROOT/public/audio/$locale/$vi/$sid.mp3"
  mkdir -p "$(dirname "$out")"
  local text
  text=$(printf '%s' "$b64" | base64 -d)
  for attempt in 1 2 3; do
    if "$ROOT/.venv/bin/edge-tts" --voice "$voice" --text "$text" --write-media "$out.part" 2>>/tmp/edge-tts.err; then
      if [ "$(stat -c%s "$out.part" 2>/dev/null || echo 0)" -gt 1024 ]; then
        mv -f "$out.part" "$out"
        return 0
      fi
    fi
    sleep "$((attempt * 2))"
  done
  echo "FAILED $locale/$vi/$sid" >&2
  rm -f "$out.part"
  return 1
}
export -f one
export ROOT

awk -F'\t' '{print $0}' "$TMP" | xargs -P "$JOBS" -d '\n' -I{} bash -c '
  IFS=$'"'"'\t'"'"' read -r a b c d e <<< "{}"
  one "$a" "$b" "$c" "$d" "$e"
' _
echo "done"
