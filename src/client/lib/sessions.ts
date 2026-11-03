import { readJson, writeJson } from './storage';

/** 記住每個房間的座位憑證，重新整理或斷線後才回得去。 */
const KEY = 'xiangqi.sessions';
const MAX_SESSIONS = 8;

type Sessions = Record<string, { token: string; savedAt: number }>;

export const sessionToken = (code: string): string | undefined =>
  readJson<Sessions>(KEY, {})[code]?.token;

export function saveSession(code: string, token: string): void {
  const sessions = readJson<Sessions>(KEY, {});
  sessions[code] = { token, savedAt: Date.now() };
  const newest = Object.entries(sessions)
    .sort(([, a], [, b]) => b.savedAt - a.savedAt)
    .slice(0, MAX_SESSIONS);
  writeJson(KEY, Object.fromEntries(newest));
}

export function forgetSession(code: string): void {
  const sessions = readJson<Sessions>(KEY, {});
  delete sessions[code];
  writeJson(KEY, sessions);
}
