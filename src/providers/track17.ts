export interface Track17Config {
  consoleUrl: string;
  email: string;
  password: string;
  token: string | null;
}

/** Lee la cuenta de 17TRACK del entorno. La clave no sale de esta función. */
export function track17FromEnv(): Track17Config | null {
  const email = process.env.TRACK17_EMAIL?.trim();
  const password = process.env.TRACK17_PASSWORD?.trim();
  if (!email || !password) return null;
  const token = process.env.TRACK17_TOKEN?.trim() || null;
  return {
    consoleUrl: process.env.TRACK17_CONSOLE_URL?.trim() || "https://user.17track.net/es",
    email,
    password,
    token,
  };
}

export function track17Status(config: Track17Config | null): { configured: boolean; apiReady: boolean } {
  return { configured: config !== null, apiReady: Boolean(config?.token) };
}
