#!/usr/bin/env bash
# Línea base "limpia" (como la define el PDF): conversación nueva, sin instrucciones ni archivos del arnés.
# - copia de master (sin AGENTS.md, sin .grok/, sin docs/harness, sin scripts del arnés)
# - el correo va pegado en el prompt, como lo daría un usuario normal (no hay carpeta harness/)
# - GROK_HOME nuevo por caso: sin sesiones previas, sin skills/hooks de usuario; solo el login
# - --sandbox strict: no puede leer el repo del arnés ni los esperados
# uso: harness/correr-base.sh <caso>
set -uo pipefail
CASO=$1; FASE=sin-arnes-limpia
REPO=$(cd "$(dirname "$0")/.." && pwd)
RUN=/workspace/runs/$FASE/$CASO; GH=/tmp/grokhome-base-$CASO
rm -rf "$RUN" "$GH"; mkdir -p "$RUN" "$GH" "$REPO/harness/logs/$FASE"
git -C "$REPO" archive master | tar -x -C "$RUN"
cp -r "$REPO/node_modules" "$RUN/"
( cd "$RUN" && git init -q && git add -A && git -c user.name=runner -c user.email=runner@local commit -qm base )
cp ~/.grok/auth.json ~/.grok/config.toml "$GH/"; mkdir -p "$GH/bin"; cp ~/.grok/bin/grok "$GH/bin/"
CORREO=$(cat "$REPO/harness/casos-fuente/$CASO.txt")
PROMPT="Este es un correo de despacho de una tienda que parseDispatchEmail (src/providers/email.ts) no lee correctamente:

$CORREO

Arregla el parser para que de ese correo extraiga bien la tienda, el número de pedido, la guía y la transportadora."
echo "$PROMPT" > "$REPO/harness/logs/$FASE/$CASO.prompt.txt"
START=$(date +%s)
( cd "$RUN" && GROK_HOME="$GH" timeout 900 "$GH/bin/grok" -p "$PROMPT" --trust --always-approve --sandbox strict --max-turns 40 --output-format streaming-json ) > "$REPO/harness/logs/$FASE/$CASO.grok.jsonl" 2> "$REPO/harness/logs/$FASE/$CASO.stderr.txt"
echo "exit=$? segundos=$(( $(date +%s) - START ))" > "$REPO/harness/logs/$FASE/$CASO.meta.txt"
( cd "$RUN" && git diff > "$REPO/harness/logs/$FASE/$CASO.diff"; git status --porcelain >> "$REPO/harness/logs/$FASE/$CASO.meta.txt" )
# Solo para evaluar (después de la corrida): el evaluador lee el correo desde harness/casos/.
mkdir -p "$RUN/harness/casos"; cp "$REPO/harness/casos-fuente/$CASO.txt" "$RUN/harness/casos/"
bun "$REPO/harness/evaluar.ts" "$RUN" "$CASO" "$REPO/harness/esperados" > "$REPO/harness/logs/$FASE/$CASO.eval.json"
grep -E '"terminado"|c[1-5]_|ciclo[12]_' "$REPO/harness/logs/$FASE/$CASO.eval.json" | tr -d '\n '; echo " <- $FASE/$CASO"
if grep -qE 'prototype-grabit|esperados|\.grok/sessions|AGENTS\.md' "$REPO/harness/logs/$FASE/$CASO.grok.jsonl"; then echo "REVISAR-CONTAMINACION" >> "$REPO/harness/logs/$FASE/$CASO.meta.txt"; echo "  !! revisar $CASO"; fi
rm -rf "$GH"
