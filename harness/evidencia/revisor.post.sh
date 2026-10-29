# Deja como cambio pendiente EXACTAMENTE lo que Grok cambió en la corrida del ciclo 2 ($CASO):
# se aplica su diff registrado (harness/logs/ciclo2/$CASO.diff) sobre el mismo commit base de esa corrida (d45c480)
# y se copian los archivos nuevos del caso. Ya no se copian los archivos de memoria completos (eso falseaba el diff de errores.md).
set -e
git apply "$REPO/harness/logs/ciclo2/$CASO.diff"
cp /workspace/runs/ciclo2/$CASO/harness/casos/* harness/casos/
