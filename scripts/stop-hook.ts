/**
 * Hook Stop de Grok (capítulos 5 y 6): no deja terminar el turno si la verificación falla.
 * Límite de reintentos: 3 bloqueos por sesión; después deja terminar y marca el caso para revisión humana.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
const ev = JSON.parse((await Bun.stdin.text()) || "{}");
const sid = String(ev.sessionId ?? ev.session_id ?? "sin-sesion");
mkdirSync(".harness-state", { recursive: true });
const f = `.harness-state/intentos-${sid}`;
const raw = existsSync(f) ? readFileSync(f, "utf8").trim() : "0";
if (raw === "humana") process.exit(0); // ya se marcó para revisión humana: no repetir la línea
const n = Number(raw);
const r = spawnSync("bun", ["scripts/verificar.ts"], { encoding: "utf8" });
if (r.status === 0) process.exit(0);
if (n >= 3) {
  appendFileSync("harness/memoria/progreso.md", `\n- ${new Date().toISOString()} sesión ${sid}: 3 intentos fallidos, REQUIERE REVISION HUMANA.\n`);
  writeFileSync(f, "humana");
  process.exit(0);
}
writeFileSync(f, String(n + 1));
console.error(`La verificación falló (intento ${n + 1}/3). Corrige antes de terminar:\n${(r.stdout + r.stderr).slice(-3000)}`);
process.exit(2);
