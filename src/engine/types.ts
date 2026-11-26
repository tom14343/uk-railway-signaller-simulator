export type Direction = 'up' | 'down';

export type Aspect = 'red' | 'yellow' | 'double-yellow' | 'green';

export type PointPos = 'normal' | 'reverse';

export type SectionKind = 'running' | 'platform' | 'diagonal';

export interface LineDef {
  id: string;
  name: string;
  shortName: string;
  direction: Direction;
  y: number;
}

export interface StationDef {
  id: string;
  name: string;
  x: number;
}

export interface BoundaryDef {
  id: string;
  name: string;
  x: number;
  side: 'west' | 'east';
}

export interface NodeDef {
  id: string;
  x: number;
  y: number;
  kind: 'boundary' | 'station' | 'mid' | 'crossover';
  stationId?: string;
  transitions: NodeTransition[];
}

export interface NodeTransition {
  inSection: string;
  pointId?: string;
  requires?: PointPos;
  outSection: string;
}

export interface SectionDef {
  id: string;
  line: string;
  kind: SectionKind;
  stationId?: string;
  crossover?: string;
  from: string;
  to: string;
  length: number;
}

export interface PointDef {
  id: string;
  label: string;
  node: string;
  x: number;
  y: number;
}

export interface SignalDef {
  id: string;
  label: string;
  node: string;
  line: string;
  direction: Direction;
  guards: string;
  x: number;
  y: number;
  side: 1 | -1;
}

export interface RouteDef {
  id: string;
  signalId: string;
  description: string;
  toSignalId: string | null;
  toBoundary: string | null;
  sections: string[];
  points: { pointId: string; pos: PointPos }[];
}

export interface MapDefinition {
  id: string;
  name: string;
  lines: LineDef[];
  stations: StationDef[];
  boundaries: BoundaryDef[];
  nodes: NodeDef[];
  sections: SectionDef[];
  points: PointDef[];
  signals: SignalDef[];
  routes: RouteDef[];
  width: number;
  height: number;
}

export interface TimedStop {
  stationId: string;
  arr: number;
  dep: number;
}

export interface TrainSchedule {
  headcode: string;
  description: string;
  line: string;
  direction: Direction;
  origin: string;
  destination: string;
  entryBoundary: string;
  exitBoundary: string;
  entryTime: number;
  stops: TimedStop[];
  maxSpeed: number;
}

export interface TrainStop {
  stationId: string;
  sectionId: string;
  arr: number;
  dep: number;
  stopPos: number;
}

export type TrainState = 'scheduled' | 'approaching' | 'en-route' | 'dwelling' | 'waiting' | 'completed';

export interface Train {
  uid: number;
  headcode: string;
  description: string;
  line: string;
  direction: Direction;
  origin: string;
  destination: string;
  entryBoundary: string;
  exitBoundary: string;
  path: string[];
  pathLengths: number[];
  totalLength: number;
  stops: TrainStop[];
  nextStopIndex: number;
  pos: number;
  speed: number;
  state: TrainState;
  dwellUntil: number | null;
  entered: boolean;
  exited: boolean;
  selected?: boolean;
}

export interface SetRoute {
  routeId: string;
  signalId: string;
  trainUid: number | null;
  touched: boolean;
}

export interface LogEntry {
  t: number;
  kind: 'info' | 'ok' | 'warn';
  message: string;
}

export interface TrainSnapshot {
  uid: number;
  headcode: string;
  description: string;
  line: string;
  direction: Direction;
  state: TrainState;
  pos: number;
  speed: number;
  sectionId: string | null;
  nextStop: string | null;
  late: boolean;
}

export interface SimSnapshot {
  clock: number;
  running: boolean;
  speed: number;
  occupied: Record<string, number>;
  aspects: Record<string, Aspect>;
  pointPositions: Record<string, PointPos>;
  routes: { routeId: string; signalId: string; description: string }[];
  trains: TrainSnapshot[];
  log: LogEntry[];
  selected: { kind: 'signal' | 'point' | 'train' | null; id: string | null };
}
