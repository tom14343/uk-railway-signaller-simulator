import type {
  BoundaryDef,
  LineDef,
  MapDefinition,
  NodeDef,
  PointDef,
  RouteDef,
  SectionDef,
  SignalDef,
  StationDef,
  TimedStop,
  TrainSchedule,
} from '../engine/types';

const SCALE = 25;

export const STATIONS: StationDef[] = [
  { id: 'marshfield', name: 'Marshfield', x: 114 },
  { id: 'adamfield', name: 'Adamfield', x: 240 },
  { id: 'brackenhill', name: 'Brackenhill', x: 366 },
];

const LINES: LineDef[] = [
  { id: 'UF', name: 'Up Fast', shortName: 'UF', direction: 'up', y: 0 },
  { id: 'US', name: 'Up Slow', shortName: 'US', direction: 'up', y: 52 },
  { id: 'DS', name: 'Down Slow', shortName: 'DS', direction: 'down', y: 104 },
  { id: 'DF', name: 'Down Fast', shortName: 'DF', direction: 'down', y: 156 },
];

const BOUNDARIES: BoundaryDef[] = [
  { id: 'norton', name: 'Norton', x: 20, side: 'west' },
  { id: 'harrowgate', name: 'Harrowgate', x: 460, side: 'east' },
];

const MID_X = [65, 177, 303, 415];
const XO_X = STATIONS.map((s) => ({ a: s.x + 10, b: s.x + 18, c: s.x + 26 }));

function nodeX(tag: string, lineId: string): number {
  if (tag === 'w') return BOUNDARIES[0].x;
  if (tag === 'e') return BOUNDARIES[1].x;
  if (tag.startsWith('m')) return MID_X[Number(tag[1])];
  if (tag.startsWith('s')) {
    const st = STATIONS[Number(tag[1]) - 1];
    return tag.endsWith('w') ? st.x - 4 : st.x + 4;
  }
  const ci = Number(tag.replace(/\D/g, '')) - 1;
  const xs = XO_X[ci];
  if (lineId === 'US') return tag.endsWith('a') ? xs.a : xs.c;
  if (lineId === 'DS') return tag.endsWith('d') ? xs.c : xs.a;
  return xs.b;
}

const UP_ORDER: Record<string, string[]> = {
  UF: ['w', 'm0', 's1w', 's1e', 'c1', 'm1', 's2w', 's2e', 'c2', 'm2', 's3w', 's3e', 'c3', 'm3', 'e'],
  US: ['w', 'm0', 's1w', 's1e', 'c1a', 'c1b', 'm1', 's2w', 's2e', 'c2a', 'c2b', 'm2', 's3w', 's3e', 'c3a', 'c3b', 'm3', 'e'],
};

const DOWN_ORDER: Record<string, string[]> = {
  DS: ['e', 'm3', 'c3d', 'c3a', 's3e', 's3w', 'm2', 'c2d', 'c2a', 's2e', 's2w', 'm1', 'c1d', 'c1a', 's1e', 's1w', 'm0', 'w'],
  DF: ['e', 'm3', 'c3', 's3e', 's3w', 'm2', 'c2', 's2e', 's2w', 'm1', 'c1', 's1e', 's1w', 'm0', 'w'],
};

const DIAGONALS: { id: string; line: string; from: string; to: string; crossover: string }[] = [];
for (let i = 1; i <= 3; i++) {
  DIAGONALS.push(
    { id: `US.d${i}`, line: 'US', from: `US.c${i}a`, to: `UF.c${i}`, crossover: `up${i}` },
    { id: `UF.d${i}`, line: 'UF', from: `UF.c${i}`, to: `US.c${i}b`, crossover: `up${i}` },
    { id: `DS.d${i}`, line: 'DS', from: `DS.c${i}d`, to: `DF.c${i}`, crossover: `down${i}` },
    { id: `DF.d${i}`, line: 'DF', from: `DF.c${i}`, to: `DS.c${i}a`, crossover: `down${i}` },
  );
}

function buildMap(): MapDefinition {
  const nodes = new Map<string, NodeDef>();
  const sections: SectionDef[] = [];
  const points: PointDef[] = [];
  const signals: SignalDef[] = [];

  const nodeKind = (tag: string): NodeDef['kind'] => {
    if (tag === 'w' || tag === 'e') return 'boundary';
    if (tag.startsWith('m')) return 'mid';
    if (tag.startsWith('s')) return 'station';
    return 'crossover';
  };

  const stationOf = (tag: string): string | undefined => {
    if (!tag.startsWith('s')) return undefined;
    return STATIONS[Number(tag[1]) - 1].id;
  };

  for (const line of LINES) {
    const order = line.direction === 'up' ? UP_ORDER[line.id] : DOWN_ORDER[line.id];
    for (const tag of order) {
      const id = `${line.id}.${tag}`;
      nodes.set(id, {
        id,
        x: nodeX(tag, line.id),
        y: line.y,
        kind: nodeKind(tag),
        stationId: stationOf(tag),
        transitions: [],
      });
    }
    for (let i = 0; i < order.length - 1; i++) {
      const fromTag = order[i];
      const toTag = order[i + 1];
      const from = `${line.id}.${fromTag}`;
      const to = `${line.id}.${toTag}`;
      const stationPair =
        fromTag.startsWith('s') &&
        toTag.startsWith('s') &&
        fromTag[1] === toTag[1] &&
        fromTag.endsWith(line.direction === 'up' ? 'w' : 'e') &&
        toTag.endsWith(line.direction === 'up' ? 'e' : 'w');
      const a = nodes.get(from)!;
      const b = nodes.get(to)!;
      sections.push({
        id: `${line.id}.s${i}`,
        line: line.id,
        kind: stationPair ? 'platform' : 'running',
        stationId: stationPair ? stationOf(fromTag) : undefined,
        from,
        to,
        length: Math.abs(b.x - a.x) * SCALE,
      });
    }
  }

  for (const d of DIAGONALS) {
    const a = nodes.get(d.from)!;
    const b = nodes.get(d.to)!;
    sections.push({
      id: d.id,
      line: d.line,
      kind: 'diagonal',
      crossover: d.crossover,
      from: d.from,
      to: d.to,
      length: Math.abs(b.x - a.x) * SCALE + 420,
    });
  }

  const incoming = new Map<string, SectionDef[]>();
  const outgoing = new Map<string, SectionDef[]>();
  for (const s of sections) {
    const ins = incoming.get(s.to) ?? [];
    ins.push(s);
    incoming.set(s.to, ins);
    const outs = outgoing.get(s.from) ?? [];
    outs.push(s);
    outgoing.set(s.from, outs);
  }

  const pointAtNode = new Map<string, string>();
  for (const [nodeId, ins] of incoming) {
    const node = nodes.get(nodeId)!;
    if (node.kind !== 'crossover') continue;
    const outs = outgoing.get(nodeId) ?? [];
    const hasDiagOut = outs.some((s) => s.kind === 'diagonal');
    const hasRunIn = ins.some((s) => s.kind !== 'diagonal');
    if (hasDiagOut && hasRunIn) {
      const pid = `pt.${nodeId}`;
      pointAtNode.set(nodeId, pid);
      points.push({ id: pid, label: nodeId, node: nodeId, x: node.x, y: node.y });
    }
  }

  for (const [nodeId, ins] of incoming) {
    const node = nodes.get(nodeId)!;
    const outs = outgoing.get(nodeId) ?? [];
    if (outs.length === 0) continue;
    const pid = pointAtNode.get(nodeId);
    for (const sin of ins) {
      if (sin.kind === 'diagonal') {
        for (const sout of outs.filter((s) => s.kind !== 'diagonal')) {
          node.transitions.push({ inSection: sin.id, outSection: sout.id });
        }
        continue;
      }
      const runOuts = outs.filter((s) => s.kind !== 'diagonal');
      const diagOuts = outs.filter((s) => s.kind === 'diagonal');
      if (pid && diagOuts.length > 0) {
        for (const sout of runOuts) {
          node.transitions.push({ inSection: sin.id, pointId: pid, requires: 'normal', outSection: sout.id });
        }
        for (const sout of diagOuts) {
          node.transitions.push({ inSection: sin.id, pointId: pid, requires: 'reverse', outSection: sout.id });
        }
      } else {
        for (const sout of runOuts) {
          node.transitions.push({ inSection: sin.id, outSection: sout.id });
        }
      }
    }
  }

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const nodeSignal = new Map<string, SignalDef>();

  for (const line of LINES) {
    const order = line.direction === 'up' ? UP_ORDER[line.id] : DOWN_ORDER[line.id];
    const exitTag = line.direction === 'up' ? 'e' : 'w';
    for (const tag of order) {
      if (tag === exitTag) continue;
      const nodeId = `${line.id}.${tag}`;
      const node = nodes.get(nodeId)!;
      if (node.kind === 'crossover') continue;
      const outs = (outgoing.get(nodeId) ?? []).filter((s) => s.kind !== 'diagonal');
      if (outs.length === 0) continue;
      const guarded = outs[0];
      const sig: SignalDef = {
        id: `SIG.${line.id}.${tag.toUpperCase()}`,
        label: `${line.id}-${tag.toUpperCase()}`,
        node: nodeId,
        line: line.id,
        direction: line.direction,
        guards: guarded.id,
        x: node.x,
        y: line.y,
        side: line.direction === 'up' ? -1 : 1,
      };
      signals.push(sig);
      nodeSignal.set(nodeId, sig);
    }
  }

  const routes: RouteDef[] = [];
  for (const sig of signals) {
    const found = enumerateRoutes(sig, sectionById, nodes, nodeSignal);
    if (found.length < 2) continue;
    found.forEach((r, idx) => {
      routes.push({
        id: `RT.${sig.id}.${idx + 1}`,
        signalId: sig.id,
        description: r.description,
        toSignalId: r.toSignalId,
        toBoundary: r.toBoundary,
        sections: r.sections,
        points: r.points,
      });
    });
  }

  const map: MapDefinition = {
    id: 'adamfield',
    name: 'Adamfield',
    lines: LINES,
    stations: STATIONS,
    boundaries: BOUNDARIES,
    nodes: [...nodes.values()],
    sections,
    points,
    signals,
    routes,
    width: 480,
    height: 190,
  };
  return map;
}

interface EnumeratedRoute {
  sections: string[];
  toSignalId: string | null;
  toBoundary: string | null;
  points: { pointId: string; pos: 'normal' | 'reverse' }[];
  description: string;
}

function enumerateRoutes(
  sig: SignalDef,
  sectionById: Map<string, SectionDef>,
  nodes: Map<string, NodeDef>,
  nodeSignal: Map<string, SignalDef>,
): EnumeratedRoute[] {
  const results: EnumeratedRoute[] = [];
  const seen = new Set<string>();

  const walk = (
    sectionId: string,
    path: string[],
    pts: Map<string, 'normal' | 'reverse'>,
    depth: number,
  ) => {
    if (depth > 40) return;
    const sec = sectionById.get(sectionId);
    if (!sec) return;
    const node = nodes.get(sec.to);
    if (!node) return;
    const nextSig = nodeSignal.get(node.id);
    if (nextSig && nextSig.id !== sig.id) {
      const key = path.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        const diagId = path.find((p) => sectionById.get(p)?.kind === 'diagonal');
        const otherLine = diagId ? sectionById.get(diagId)!.to.split('.')[0] : null;
        results.push({
          sections: [...path],
          toSignalId: nextSig.id,
          toBoundary: null,
          points: [...pts.entries()].map(([pointId, pos]) => ({ pointId, pos })),
          description: diagId ? `Diverge via ${otherLine}` : 'Proceed',
        });
      }
      return;
    }
    const transitions = node.transitions.filter((t) => t.inSection === sectionId);
    if (transitions.length === 0) {
      const key = path.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          sections: [...path],
          toSignalId: null,
          toBoundary: node.id,
          points: [...pts.entries()].map(([pointId, pos]) => ({ pointId, pos })),
          description: 'Proceed to boundary',
        });
      }
      return;
    }
    for (const t of transitions) {
      const npath = [...path, t.outSection];
      const npts = new Map(pts);
      if (t.pointId && t.requires) {
        const existing = npts.get(t.pointId);
        if (existing && existing !== t.requires) continue;
        npts.set(t.pointId, t.requires);
      }
      walk(t.outSection, npath, npts, depth + 1);
    }
  };

  walk(sig.guards, [sig.guards], new Map(), 0);
  return results;
}

function t(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60;
}

export function buildAdamfieldTimetable(): TrainSchedule[] {
  const sched: TrainSchedule[] = [];
  const stop = (stationId: string, arr: string, dep: string): TimedStop => ({
    stationId,
    arr: t(arr),
    dep: t(dep),
  });

  const up: [string, string, string, TimedStop[]][] = [
    ['1A01', 'UF', 'Express Passenger', [stop('adamfield', '06:13', '06:15')]],
    ['2C15', 'US', 'Stopping Passenger', [stop('marshfield', '06:32', '06:35'), stop('adamfield', '06:38', '06:42'), stop('brackenhill', '06:45', '06:48')]],
    ['1A02', 'UF', 'Express Passenger', [stop('adamfield', '06:53', '06:55')]],
    ['2C16', 'US', 'Stopping Passenger', [stop('marshfield', '07:12', '07:15'), stop('adamfield', '07:18', '07:22'), stop('brackenhill', '07:25', '07:28')]],
    ['1A03', 'UF', 'Express Passenger', [stop('adamfield', '07:33', '07:35')]],
    ['2C17', 'US', 'Stopping Passenger', [stop('marshfield', '07:52', '07:55'), stop('adamfield', '07:58', '08:02'), stop('brackenhill', '08:05', '08:08')]],
    ['1A04', 'UF', 'Express Passenger', [stop('adamfield', '08:13', '08:15')]],
    ['2C18', 'US', 'Stopping Passenger', [stop('marshfield', '08:32', '08:35'), stop('adamfield', '08:38', '08:42'), stop('brackenhill', '08:45', '08:48')]],
    ['1A05', 'UF', 'Express Passenger', [stop('adamfield', '08:53', '08:55')]],
    ['2C19', 'US', 'Stopping Passenger', [stop('marshfield', '09:12', '09:15'), stop('adamfield', '09:18', '09:22'), stop('brackenhill', '09:25', '09:28')]],
  ];

  const down: [string, string, string, TimedStop[]][] = [
    ['1D01', 'DF', 'Express Passenger', [stop('adamfield', '06:23', '06:25')]],
    ['2D15', 'DS', 'Stopping Passenger', [stop('brackenhill', '06:42', '06:45'), stop('adamfield', '06:48', '06:52'), stop('marshfield', '06:55', '06:58')]],
    ['1D02', 'DF', 'Express Passenger', [stop('adamfield', '07:03', '07:05')]],
    ['2D16', 'DS', 'Stopping Passenger', [stop('brackenhill', '07:22', '07:25'), stop('adamfield', '07:28', '07:32'), stop('marshfield', '07:35', '07:38')]],
    ['1D03', 'DF', 'Express Passenger', [stop('adamfield', '07:43', '07:45')]],
    ['2D17', 'DS', 'Stopping Passenger', [stop('brackenhill', '08:02', '08:05'), stop('adamfield', '08:08', '08:12'), stop('marshfield', '08:15', '08:18')]],
    ['1D04', 'DF', 'Express Passenger', [stop('adamfield', '08:23', '08:25')]],
    ['2D18', 'DS', 'Stopping Passenger', [stop('brackenhill', '08:42', '08:45'), stop('adamfield', '08:48', '08:52'), stop('marshfield', '08:55', '08:58')]],
    ['1D05', 'DF', 'Express Passenger', [stop('adamfield', '09:03', '09:05')]],
    ['2D19', 'DS', 'Stopping Passenger', [stop('brackenhill', '09:22', '09:25'), stop('adamfield', '09:28', '09:32'), stop('marshfield', '09:35', '09:38')]],
  ];

  const upEntries = ['06:10', '06:30', '06:50', '07:10', '07:30', '07:50', '08:10', '08:30', '08:50', '09:10'];
  const downEntries = ['06:20', '06:40', '07:00', '07:20', '07:40', '08:00', '08:20', '08:40', '09:00', '09:20'];

  up.forEach(([headcode, line, desc, stops], i) => {
    sched.push({
      headcode,
      description: desc,
      line,
      direction: 'up',
      origin: 'Norton',
      destination: 'Harrowgate',
      entryBoundary: 'norton',
      exitBoundary: 'harrowgate',
      entryTime: t(upEntries[i]),
      stops,
      maxSpeed: line === 'UF' ? 34 : 24,
    });
  });

  down.forEach(([headcode, line, desc, stops], i) => {
    sched.push({
      headcode,
      description: desc,
      line,
      direction: 'down',
      origin: 'Harrowgate',
      destination: 'Norton',
      entryBoundary: 'harrowgate',
      exitBoundary: 'norton',
      entryTime: t(downEntries[i]),
      stops,
      maxSpeed: line === 'DF' ? 34 : 24,
    });
  });

  return sched;
}

export function buildAdamfield(): { map: MapDefinition; timetable: TrainSchedule[] } {
  return { map: buildMap(), timetable: buildAdamfieldTimetable() };
}
