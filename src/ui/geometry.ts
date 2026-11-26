import type { MapDefinition } from '../engine/types';

const Y_OFFSET = 26;

export interface TrainGeom {
  x: number;
  y: number;
  angle: number;
}

export function computeTrainGeometry(
  map: MapDefinition,
  trains: { uid: number; pos: number; path: string[]; lengths: number[] }[],
): Map<number, TrainGeom> {
  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const sectionById = new Map(map.sections.map((s) => [s.id, s]));
  const result = new Map<number, TrainGeom>();

  for (const t of trains) {
    if (t.pos < -1000) continue;
    let acc = 0;
    let idx = 0;
    const pos = Math.max(0, t.pos);
    for (let i = 0; i < t.path.length; i++) {
      if (pos < acc + t.lengths[i] || i === t.path.length - 1) {
        idx = i;
        break;
      }
      acc += t.lengths[i];
    }
    const sec = sectionById.get(t.path[idx]);
    if (!sec) continue;
    const a = nodeById.get(sec.from);
    const b = nodeById.get(sec.to);
    if (!a || !b) continue;
    const frac = Math.min(1, Math.max(0, (pos - acc) / sec.length));
    const x1 = a.x;
    const y1 = a.y + Y_OFFSET;
    const x2 = b.x;
    const y2 = b.y + Y_OFFSET;
    const x = x1 + (x2 - x1) * frac;
    const y = y1 + (y2 - y1) * frac;
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    result.set(t.uid, { x, y, angle });
  }
  return result;
}

