export interface ServerConfig {
  port: number;
  host: string;
  clientDir: string;
  allowedOrigins: string[];
  trustProxy: boolean;
  maxRooms: number;
  roomIdleTtlMs: number;
  /** 開發模式下允許的即時重載來源。 */
  devReloadOrigin: string | null;
}

const positiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: positiveInt(env.PORT, 3000),
    host: env.HOST ?? '0.0.0.0',
    clientDir: env.CLIENT_DIR ?? 'dist/client',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    maxRooms: positiveInt(env.MAX_ROOMS, 2000),
    roomIdleTtlMs: positiveInt(env.ROOM_IDLE_TTL_MINUTES, 30) * 60_000,
    devReloadOrigin: env.DEV_RELOAD_ORIGIN ?? null,
  };
}
