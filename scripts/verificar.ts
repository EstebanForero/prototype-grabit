/**
 * Paso de verificación (capítulo 6): reglas fijas antes de entregar.
 * 1) Cada correo de harness/casos tiene su JSON esperado y el parser lo produce exacto.
 * 2) La suite completa (bun test) pasa.
 * 3) (v2) Ninguna prueba lee harness/casos/.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
// Regla fija (ciclo 1): las pruebas no pueden depender de la bandeja temporal harness/casos/.
const dependientes = readdirSync("tests").filter((f) => readFileSync(`tests/${f}`, "utf8").includes("harness/casos"));
if (dependientes.length) { console.error(`VERIFICACION FALLIDA: ${dependientes.join(", ")} lee harness/casos/; copia el correo dentro de la prueba.`); process.exit(1); }
const pasos: string[][] = [["bun", "scripts/verificar-correos.ts"], ["bun", "test"]];
for (const p of pasos) {
  const r = spawnSync(p[0], p.slice(1), { encoding: "utf8" });
  process.stdout.write(r.stdout ?? ""); process.stderr.write(r.stderr ?? "");
  if (r.status !== 0) { console.error(`VERIFICACION FALLIDA: ${p.join(" ")}`); process.exit(1); }
}
console.log("VERIFICACION OK");
