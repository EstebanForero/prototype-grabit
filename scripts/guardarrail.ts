/**
 * Guardarraíl (capítulo 5). Vive fuera del modelo.
 *   bun scripts/guardarrail.ts tool    -> hook PreToolUse de Grok (stdin = JSON del evento)
 *   bun scripts/guardarrail.ts commit  -> hook pre-commit de git
 * Exit 2 = deniega la herramienta. Exit 1 = aborta el commit.
 */
import { spawnSync } from "node:child_process";

export const PROTEGIDOS = [/(^|\/)\.env$/, /src\/contract\.ts$/, /migrations\//, /src\/data\/schema\.sql$/, /fixtures\/correos\//];
const COMANDOS_PROHIBIDOS = [/git\s+push/, /--no-verify/, /git\s+reset\s+--hard/, /rm\s+-rf/];

export function bloqueados(paths: string[]): string[] {
  return paths.filter((p) => PROTEGIDOS.some((r) => r.test(p)));
}

function negar(msg: string): never {
  console.error(`GUARDARRAIL: ${msg}`);
  process.exit(2);
}

if (import.meta.main) {
  const modo = process.argv[2] ?? "commit";
  if (modo === "tool") {
    const ev = JSON.parse((await Bun.stdin.text()) || "{}");
    // Grok envía toolInput (camelCase); Claude Code envía tool_input. Se aceptan los dos.
    const input = ev.toolInput ?? ev.tool_input ?? {};
    const ruta = String(input.file_path ?? input.path ?? input.target_file ?? "");
    if (ruta && bloqueados([ruta]).length) negar(`${ruta} es un archivo protegido; requiere aprobación humana.`);
    const cmd = String(input.command ?? "");
    if (cmd) {
      const malo = COMANDOS_PROHIBIDOS.find((r) => r.test(cmd));
      if (malo) negar(`comando prohibido (${malo}); lo hace una persona.`);
      if (PROTEGIDOS.some((r) => r.test(cmd)) && /(>|sed\s+-i|mv\s|cp\s|tee\s)/.test(cmd)) negar("el comando escribe un archivo protegido.");
    }
    process.exit(0);
  }
  const diff = spawnSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const malos = bloqueados(diff);
  if (malos.length && process.env.APROBADO_POR_HUMANO !== "1") {
    console.error(`GUARDARRAIL: el commit toca archivos protegidos: ${malos.join(", ")}. Requiere APROBADO_POR_HUMANO=1.`);
    process.exit(1);
  }
  const r = spawnSync("bun", ["scripts/verificar.ts"], { stdio: "inherit" });
  if (r.status !== 0) { console.error("GUARDARRAIL: la verificación falló; no se hace el commit."); process.exit(1); }
}
