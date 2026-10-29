#!/usr/bin/env bash
# Corre UN caso con Grok CLI en una copia aislada y nueva (sesión nueva) del repo.
# uso: harness/correr.sh <fase> <caso> <git-ref>
#   fase: sin-arnes | con-arnes | ciclo1 | ciclo2      git-ref: master (sin arnés) o el commit del arnés
set -uo pipefail
FASE=$1; CASO=$2; REF=$3
REPO=$(cd "$(dirname "$0")/.." && pwd)
RUN=/workspace/runs/$FASE/$CASO
rm -rf "$RUN"; mkdir -p "$RUN" "$REPO/harness/logs/$FASE"
git -C "$REPO" archive "$REF" | tar -x -C "$RUN"
# El agente nunca ve las respuestas esperadas ni el evaluador.
rm -rf "$RUN/harness/esperados" "$RUN/harness/evaluar.ts" "$RUN/harness/correr.sh" "$RUN/harness/logs" "$RUN/harness/casos-fuente"
mkdir -p "$RUN/harness/casos"; cp "$REPO/harness/casos-fuente/$CASO.txt" "$RUN/harness/casos/"
cp -r "$REPO/node_modules" "$RUN/"
( cd "$RUN" && git init -q && git add -A && git -c user.name=runner -c user.email=runner@local commit -qm base && git config core.hooksPath .githooks )
PROMPT="El correo harness/casos/$CASO.txt es un correo de despacho de una tienda que parseDispatchEmail (src/providers/email.ts) no lee correctamente. Arregla el parser para que de ese correo extraiga bien la tienda, el número de pedido, la guía y la transportadora."
START=$(date +%s)
( cd "$RUN" && timeout 900 ~/.grok/bin/grok -p "$PROMPT" --trust --always-approve --sandbox strict --max-turns 40 --output-format streaming-json ) > "$REPO/harness/logs/$FASE/$CASO.grok.jsonl" 2> "$REPO/harness/logs/$FASE/$CASO.stderr.txt"
echo "exit=$? segundos=$(( $(date +%s) - START ))" > "$REPO/harness/logs/$FASE/$CASO.meta.txt"
( cd "$RUN" && git diff > "$REPO/harness/logs/$FASE/$CASO.diff"; git status --porcelain >> "$REPO/harness/logs/$FASE/$CASO.meta.txt" )
bun "$REPO/harness/evaluar.ts" "$RUN" "$CASO" "$REPO/harness/esperados" > "$REPO/harness/logs/$FASE/$CASO.eval.json"
grep -E '"terminado"|c[1-5]_|ciclo[12]_' "$REPO/harness/logs/$FASE/$CASO.eval.json" | tr -d '\n '; echo " <- $FASE/$CASO"
# Control de contaminación: la corrida no debe haber mirado fuera de su copia.
if grep -qE 'prototype-grabit|runs/esperados|harness/esperados' "$REPO/harness/logs/$FASE/$CASO.grok.jsonl"; then echo "CONTAMINADA" >> "$REPO/harness/logs/$FASE/$CASO.meta.txt"; echo "  !! CONTAMINADA $FASE/$CASO"; fi
