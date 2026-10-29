# Trae el cambio que dejó Grok en la corrida del ciclo 2 ($CASO) como cambio pendiente para el revisor.
S=/workspace/runs/ciclo2/$CASO
cp "$S/src/providers/email.ts" src/providers/email.ts
cp -r "$S/tests/." tests/
cp "$S/harness/memoria/"*.md harness/memoria/
cp "$S"/harness/casos/* harness/casos/
