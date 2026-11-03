import { useSyncExternalStore } from 'react';
import { readJson, writeJson } from './storage';

export type ThemeId = 'pine' | 'porcelain' | 'night';

export interface Settings {
  name: string;
  theme: ThemeId;
  sound: boolean;
  showMoves: boolean;
}

export const THEMES: readonly { id: ThemeId; label: string; description: string }[] = [
  { id: 'pine', label: '松林', description: '松綠桌面配竹色棋盤' },
  { id: 'porcelain', label: '青花', description: '白瓷底配鈷藍線條' },
  { id: 'night', label: '夜弈', description: '深藍桌面，晚上不刺眼' },
];

const KEY = 'xiangqi.settings';
const DEFAULTS: Settings = { name: '', theme: 'pine', sound: true, showMoves: true };

let current: Settings = { ...DEFAULTS, ...readJson<Partial<Settings>>(KEY, {}) };
const listeners = new Set<() => void>();

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  writeJson(KEY, current);
  applyTheme(current.theme);
  listeners.forEach((listener) => listener());
}

export const getSettings = (): Settings => current;

export function useSettings(): Settings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
