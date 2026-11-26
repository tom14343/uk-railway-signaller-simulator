export interface Settings {
  defaultSpeed: number;
  showLabels: boolean;
}

const KEY = 'adamfield-settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        defaultSpeed: [1, 2, 4, 8, 16].includes(parsed.defaultSpeed ?? 0) ? parsed.defaultSpeed! : 1,
        showLabels: parsed.showLabels ?? true,
      };
    }
  } catch {}
  return { defaultSpeed: 1, showLabels: true };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
