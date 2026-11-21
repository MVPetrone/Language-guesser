#!/usr/bin/env bash
# Build the static game + the PHP admin/CRM and publish to lingoguess.com.
#
#   ./scripts/deploy-lingoguess.sh          build, commit, push the deploy branch
#   ./scripts/deploy-lingoguess.sh --ship   ...and trigger the Hostinger Git deploy
#
# The live tree is index.html + assets + audio + /admin (PHP). Two traps:
#   * the base path is "/" on the real domain (already the default in
#     vite.config.ts), and is passed explicitly here for belt and braces;
#   * the deploy branch must keep real history, so it lives in a worktree of this
#     repo instead of a scratch git init (a fresh init cannot fast-forward).
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO/dist-web"
STAGE="${STAGE:-/var/tmp/lingo-deploy}"
BRANCH=deploy/lingoguess
DOMAIN=lingoguess.com
USER_NAME=u806443369

cd "$REPO"
echo "== build (base /)"
node ./node_modules/vite/bin/vite.js build --base=/ --outDir=dist-web >/tmp/build-web.log 2>&1 || { tail -20 /tmp/build-web.log; exit 1; }
tail -3 /tmp/build-web.log

echo "== stage admin app"
rm -rf "$OUT/admin"
mkdir -p "$OUT/admin"
cp -a "$REPO/server/admin/." "$OUT/admin/"
find "$OUT/admin" -name '*.log' -delete 2>/dev/null || true

echo "== deploy worktree"
git worktree prune
if [ ! -e "$STAGE/.git" ]; then
  rm -rf "$STAGE"
  git fetch -q origin "$BRANCH" || true
  git worktree add -B "$BRANCH" "$STAGE" "origin/$BRANCH" 2>/dev/null || git worktree add -B "$BRANCH" "$STAGE" HEAD
fi

# --checksum: index.html keeps its byte size when only the bundle hash changes.
rsync -a --checksum --delete --exclude '.git' "$OUT/" "$STAGE/"
touch "$STAGE/.nojekyll"

cd "$STAGE"
git add -A
if git diff --cached --quiet; then
  echo "no changes to publish"
else
  git -c user.name=MVPetrone -c user.email=mvpetrone@users.noreply.github.com \
    commit -qm "build: $(date -u +%Y-%m-%dT%H:%MZ) — game + admin"
  git push -q origin "$BRANCH"
  echo "pushed $(git rev-parse --short HEAD)"
fi

if [ "${1:-}" = "--ship" ]; then
  echo "== trigger Hostinger Git deploy"
  # Repo still lives at Language-guesser until the GitHub rename lands (token lacks
  # admin scope). GitHub redirects renamed URLs, so this keeps working afterwards.
  python3 /root/hz.py execute "{\"operation\":\"hosting_git_deploy-website-repository\",\"params\":{\"username\":\"$USER_NAME\",\"domain\":\"$DOMAIN\",\"repository_url\":\"https://github.com/MVPetrone/Language-guesser.git\",\"branch\":\"$BRANCH\"}}"
fi
