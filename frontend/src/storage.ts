import type { Settings } from './types';

const STORAGE_KEYS = {
  maxScore: 'snake:maxScore',
  settings: 'snake:settings'
} as const;

const defaultSettings: Settings = {
  speed: 'normal',
  obstacles: false,
  sound: true
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse storage value', error);
    return fallback;
  }
}

export function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return defaultSettings;
  return safeParse(localStorage.getItem(STORAGE_KEYS.settings), defaultSettings);
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function loadMaxScore(): number {
  if (typeof localStorage === 'undefined') return 0;
  const raw = localStorage.getItem(STORAGE_KEYS.maxScore);
  return raw ? Number(raw) || 0 : 0;
}

export function saveMaxScore(score: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.maxScore, String(score));
}

export { defaultSettings };
