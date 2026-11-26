export function fmtClock(t: number): string {
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor(t / 60) % 60;
  const s = Math.floor(t % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtHM(t: number): string {
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor(t / 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
