#!/usr/bin/env bash
# Corridas de evidencia (guardarrail, revision humana, retomar, revisor) con Grok CLI.
# Igual que correr-base.sh: GROK_HOME aislado por corrida (solo login), --sandbox workspace (strict no corre hooks, ver errores.md ciclo 3).
# uso: harness/correr-extra.sh <nombre> <git-ref> <max-turns> <prompt-file> [prep.sh]
set -uo pipefail
NOM=$1; REF=$2; MT=$3; PF=$4; PREP=${5:-}
REPO=$(cd "$(dirname "$0")/.." && pwd); L=$REPO/harness/logs/evidencia; mkdir -p "$L"
RUN=/workspace/runs/evidencia/$NOM; GH=/tmp/grokhome-$NOM
rm -rf "$RUN" "$GH"; mkdir -p "$RUN" "$GH/bin"
git -C "$REPO" archive "$REF" | tar -x -C "$RUN"
rm -rf "$RUN/harness/esperados" "$RUN/harness/evaluar.ts" "$RUN"/harness/correr*.sh "$RUN/harness/logs" "$RUN/harness/casos-fuente"
mkdir -p "$RUN/harness/casos"; cp -r "$REPO/node_modules" "$RUN/"
if [ -n "$PREP" ]; then ( cd "$RUN" && REPO="$REPO" bash "$PREP" ); fi
( cd "$RUN" && git init -q && git add -A && git -c user.name=runner -c user.email=runner@local commit -qm base && git config core.hooksPath .githooks )
cp ~/.grok/auth.json ~/.grok/config.toml "$GH/"; cp ~/.grok/bin/grok "$GH/bin/"
printf '[folders."%s"]\ntrusted = true\ndecided_at = %s\n' "$RUN" "$(date +%s)" > "$GH/trusted_folders.toml"
cp "$PF" "$L/$NOM.prompt.txt"
START=$(date +%s)
( cd "$RUN" && GROK_HOME="$GH" timeout 900 "$GH/bin/grok" -p "$(cat "$PF")" --trust --always-approve --sandbox workspace --max-turns "$MT" --output-format streaming-json ) > "$L/$NOM.grok.jsonl" 2> "$L/$NOM.stderr.txt"
echo "exit=$? segundos=$(( $(date +%s) - START ))" > "$L/$NOM.meta.txt"
( cd "$RUN" && git diff > "$L/$NOM.diff"; git status --porcelain >> "$L/$NOM.meta.txt"; cp harness/memoria/progreso.md "$L/$NOM.progreso-final.md" )
rm -rf "$GH"; cat "$L/$NOM.meta.txt"
