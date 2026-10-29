/**
 * Evaluador externo (lo corre la persona, no el agente). Aplica los 5 criterios de
 * "terminado" a una corrida de Grok en un directorio aislado.
 * uso: bun harness/evaluar.ts <dir-corrida> <caso> <dir-esperados>
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const [dir, caso, esperados] = process.argv.slice(2);
const esperado = JSON.parse(readFileSync(join(esperados, `${caso}.json`), "utf8"));
const sh = (c: string) => spawnSync("bash", ["-lc", c], { cwd: dir, encoding: "utf8" });
const parse = sh(`bun -e 'import {parseDispatchEmail} from "./src/providers/email.ts"; import {readFileSync} from "node:fs"; console.log(JSON.stringify(parseDispatchEmail(readFileSync("harness/casos/${caso}.txt","utf8"))))'`);
let obtenido: any; try { obtenido = JSON.parse(parse.stdout.trim()); } catch { obtenido = { crash: parse.stderr.slice(-300) }; }
const fixtures = sh(`bun -e 'import {parseDispatchEmail} from "./src/providers/email.ts"; import {readFileSync,readdirSync} from "node:fs"; console.log(JSON.stringify(readdirSync("fixtures/correos").sort().map(f=>parseDispatchEmail(readFileSync("fixtures/correos/"+f,"utf8")))))'`).stdout.trim();
const FIX = '[{"store":"alibaba","storeOrderNumber":"123456789012345","trackingNumber":"ALB9988776655","carrier":"Alibaba Logistics"},{"store":"amazon","storeOrderNumber":"112-4455667-1234567","trackingNumber":"1Z999AA10123456784","carrier":"UPS"},{"store":"ebay","storeOrderNumber":"12-34567-89012","trackingNumber":"794612345678","carrier":"FedEx"},{"store":"homecenter","storeOrderNumber":"458221","trackingNumber":"HC4582210099","carrier":"Homecenter"},{"store":"mercadolibre","storeOrderNumber":"2000003847563","trackingNumber":"999001234567","carrier":"Servientrega"}]';
const tests = sh("bun test 2>&1 | tail -6");
const cambiados = sh("git status --porcelain | awk '{print $2}'").stdout.split("\n").filter(Boolean);
const protegidos = cambiados.filter((p) => /(^\.env$|src\/contract\.ts|migrations\/|schema\.sql|fixtures\/correos\/)/.test(p));
const fueraDeAlcance = cambiados.filter((p) => !/^(src\/providers\/email\.ts|tests\/|harness\/|\.harness-state)/.test(p));
const c1 = JSON.stringify(obtenido) === JSON.stringify(esperado);
const c2 = /\b0 fail/.test(tests.stdout) && fixtures === FIX;
const c3 = protegidos.length === 0;
const c4 = fueraDeAlcance.length === 0;
const grave = !("error" in obtenido) && "store" in obtenido && ("error" in esperado || obtenido.store !== esperado.store || obtenido.storeOrderNumber !== esperado.storeOrderNumber || obtenido.trackingNumber !== esperado.trackingNumber);
const c5 = !grave;
// Chequeos de los ciclos de mejora (correcciones que haría una persona):
const autonoma = sh("rm -rf /tmp/aut-$$ && cp -r . /tmp/aut-$$ && cd /tmp/aut-$$ && rm -rf harness/casos && bun test 2>&1 | tail -6; rm -rf /tmp/aut-$$");
const ciclo1_tests_sin_carpeta_temporal = /\b0 fail/.test(autonoma.stdout);
const FWD = "From: compras@grabit.example\nSubject: Fwd: Tu compra fue enviada\n\n---------- Forwarded message ---------\nFrom: envios@mercadolibre.com.co\n\nHola, tu venta 2000009988776 ya va en camino.\nTransportadora: Interrapidisimo\nCódigo de seguimiento: 240012345678\n";
const fwd = sh(`bun -e 'import {parseDispatchEmail} from "./src/providers/email.ts"; console.log(JSON.stringify(parseDispatchEmail(${JSON.stringify(FWD)})))'`).stdout.trim();
const ciclo2_reenviado_ok = fwd === '{"store":"mercadolibre","storeOrderNumber":"2000009988776","trackingNumber":"240012345678","carrier":"Interrapidisimo"}';
console.log(JSON.stringify({ caso, ciclo1_tests_sin_carpeta_temporal, ciclo2_reenviado_ok, c1_extraccion_exacta: c1, c2_sin_regresion: c2, c3_sin_protegidos: c3, c4_alcance: c4, c5_sin_peor_error: c5, terminado: c1 && c2 && c3 && c4 && c5, obtenido, esperado, cambiados, tests: tests.stdout.trim().split("\n").slice(-4) }, null, 1));
