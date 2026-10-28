/**
 * Sensor del arnés (capítulo 6). Regla fija: cada correo de harness/casos debe
 * dar exactamente el JSON esperado. Sale con código 1 si falla uno.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseDispatchEmail } from "../src/providers/email.ts";

const dir = join(import.meta.dir, "..", "harness/casos");
let fallos = 0;
const filas: string[] = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith(".txt")).sort()) {
  const esperadoPath = join(dir, f.replace(/\.txt$/, ".json"));
  if (!existsSync(esperadoPath)) { filas.push(`FALTA-ESPERADO ${f}`); fallos++; continue; }
  const esperado = JSON.parse(readFileSync(esperadoPath, "utf8"));
  const obtenido = parseDispatchEmail(readFileSync(join(dir, f), "utf8"));
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  filas.push(`${ok ? "OK  " : "FAIL"} ${f}\n     esperado: ${JSON.stringify(esperado)}\n     obtenido: ${JSON.stringify(obtenido)}`);
}
console.log(filas.join("\n"));
console.log(`\n${filas.length - fallos}/${filas.length} casos correctos`);
process.exit(fallos ? 1 : 0);
