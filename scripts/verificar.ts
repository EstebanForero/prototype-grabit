/**
 * Paso de verificación (capítulo 6): reglas fijas antes de entregar.
 * 1) Cada correo de harness/casos tiene su JSON esperado y el parser lo produce exacto.
 * 2) La suite completa (bun test) pasa.
 */
import { spawnSync } from "node:child_process";
const pasos: string[][] = [["bun", "scripts/verificar-correos.ts"], ["bun", "test"]];
for (const p of pasos) {
  const r = spawnSync(p[0], p.slice(1), { encoding: "utf8" });
  process.stdout.write(r.stdout ?? ""); process.stderr.write(r.stderr ?? "");
  if (r.status !== 0) { console.error(`VERIFICACION FALLIDA: ${p.join(" ")}`); process.exit(1); }
}
console.log("VERIFICACION OK");
