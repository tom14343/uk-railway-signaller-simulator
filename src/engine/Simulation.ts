import type {
  Aspect,
  LogEntry,
  MapDefinition,
  NodeDef,
  PointPos,
  RouteDef,
  SectionDef,
  SignalDef,
  SimSnapshot,
  Train,
  TrainSchedule,
  TrainSnapshot,
  TrainStop,
} from './types';

export const TIME_SCALE = 5;
export const TRAIN_LENGTH = 110;
const ACCEL = 0.9;
const BRAKE = 1.05;
const STOP_MARGIN = 5;
const CLOCK_START = 6 * 3600;
const MAX_LOG = 250;

export class Simulation {
  readonly map: MapDefinition;
  private sectionById: Map<string, SectionDef>;
  private nodeById: Map<string, NodeDef>;
  private signalById = new Map<string, SignalDef>();
  private signalByNode = new Map<string, SignalDef>();
  private signalByGuards = new Map<string, SignalDef>();
  private routesBySignal = new Map<string, RouteDef[]>();
  private routeById = new Map<string, RouteDef>();
  private trains: Train[] = [];
  private uidCounter = 1;

  clock = CLOCK_START;
  running = false;
  speed = 4;
  private pointPositions = new Map<string, PointPos>();
  private activeRoutes = new Map<string, { touched: boolean }>();
  private occupied = new Map<string, number>();
  private aspects = new Map<string, Aspect>();
  private aspectCache = new Map<string, Aspect>();
  private log: LogEntry[] = [];
  private selection: SimSnapshot['selected'] = { kind: null, id: null };
  private schedules: TrainSchedule[];

  constructor(map: MapDefinition, timetable: TrainSchedule[]) {
    this.map = map;
    this.schedules = timetable;
    this.sectionById = new Map(map.sections.map((s) => [s.id, s]));
    this.nodeById = new Map(map.nodes.map((n) => [n.id, n]));
    for (const s of map.sections) this.sectionById.set(s.id, s);
    for (const s of map.signals) {
      this.signalById.set(s.id, s);
      this.signalByNode.set(s.node, s);
      this.signalByGuards.set(s.guards, s);
    }
    for (const r of map.routes) {
      this.routeById.set(r.id, r);
      const list = this.routesBySignal.get(r.signalId) ?? [];
      list.push(r);
      this.routesBySignal.set(r.signalId, list);
    }
    for (const p of map.points) this.pointPositions.set(p.id, 'normal');
    for (const sch of timetable) this.trains.push(this.buildTrain(sch));
    this.computeAspects();
  }

  private buildTrain(sch: TrainSchedule): Train {
    const entryNode = `${sch.line}.${sch.direction === 'up' ? 'w' : 'e'}`;
    const path: string[] = [];
    const lengths: number[] = [];
    let nodeId = entryNode;
    let guard = 0;
    while (guard++ < 100) {
      const outs = this.map.sections.filter((s) => s.from === nodeId && s.kind !== 'diagonal');
      if (outs.length === 0) break;
      const sec = outs[0];
      path.push(sec.id);
      lengths.push(sec.length);
      nodeId = sec.to;
      if (!this.nodeById.has(nodeId)) break;
      const node = this.nodeById.get(nodeId)!;
      const next = node.transitions.find((t) => t.inSection === sec.id && (!t.pointId || this.pointPositions.get(t.pointId) === t.requires));
      if (!next) break;
      const nextSec = this.sectionById.get(next.outSection);
      if (!nextSec || nextSec.from !== nodeId) break;
    }

    const cum: number[] = [];
    let acc = 0;
    for (const l of lengths) {
      cum.push(acc);
      acc += l;
    }

    const stops: TrainStop[] = [];
    for (const st of sch.stops) {
      const sec = this.map.sections.find(
        (s) => s.kind === 'platform' && s.line === sch.line && s.stationId === st.stationId,
      );
      if (!sec) continue;
      const idx = path.indexOf(sec.id);
      if (idx < 0) continue;
      const start = cum[idx];
      stops.push({
        stationId: st.stationId,
        sectionId: sec.id,
        arr: st.arr,
        dep: st.dep,
        stopPos: start + sec.length * 0.8,
      });
    }

    return {
      uid: this.uidCounter++,
      headcode: sch.headcode,
      description: sch.description,
      line: sch.line,
      direction: sch.direction,
      origin: sch.origin,
      destination: sch.destination,
      entryBoundary: sch.entryBoundary,
      exitBoundary: sch.exitBoundary,
      path,
      pathLengths: lengths,
      totalLength: acc,
      stops,
      nextStopIndex: 0,
      pos: -(TRAIN_LENGTH + 10),
      speed: 0,
      state: 'scheduled',
      dwellUntil: null,
      entered: false,
      exited: false,
    };
  }

  start() {
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  toggle() {
    this.running = !this.running;
  }

  setSpeed(s: number) {
    this.speed = s;
  }

  tick(dtReal: number) {
    if (!this.running) return;
    let remaining = dtReal * this.speed * TIME_SCALE;
    const h = 0.2;
    while (remaining > 0) {
      const step = Math.min(h, remaining);
      this.stepSim(step);
      remaining -= step;
    }
  }

  private stepSim(dt: number) {
    this.clock += dt;
    this.spawnTrains();
    this.updateOccupancy();
    this.moveTrains(dt);
    this.updateRoutes();
    this.computeAspects();
  }

  private spawnTrains() {
    for (const train of this.trains) {
      if (train.entered || train.exited) continue;
      const sch = this.schedules.find((s) => s.headcode === train.headcode && s.line === train.line);
      if (!sch || sch.entryTime > this.clock) continue;
      train.entered = true;
      train.state = 'approaching';
      const boundary = this.map.boundaries.find((b) => b.id === train.entryBoundary);
      this.logMessage('info', `${train.headcode} ${train.description} entered at ${boundary?.name ?? train.entryBoundary} (${train.line})`);
    }
  }

  private cumDistances(train: Train): number[] {
    const cum: number[] = [];
    let acc = 0;
    for (const l of train.pathLengths) {
      cum.push(acc);
      acc += l;
    }
    return cum;
  }

  private moveTrains(dt: number) {
    for (const train of this.trains) {
      if (!train.entered || train.exited) continue;

      if (train.dwellUntil !== null) {
        if (this.clock < train.dwellUntil) {
          train.speed = 0;
          continue;
        }
        const st = train.stops[train.nextStopIndex];
        train.dwellUntil = null;
        train.nextStopIndex += 1;
        train.state = 'en-route';
        const station = this.map.stations.find((s) => s.id === st?.stationId);
        this.logMessage('ok', `${train.headcode} departed ${station?.name ?? ''} (${train.line})`);
      }

      const cum = this.cumDistances(train);
      let targetPos: number | null = null;

      for (let i = 0; i < train.path.length; i++) {
        const secStart = cum[i];
        if (secStart < train.pos - 0.01) continue;
        const sig = this.signalByGuards.get(train.path[i]);
        if (sig && this.aspects.get(sig.id) === 'red') {
          const stopAt = secStart - STOP_MARGIN;
          if (stopAt > train.pos && (targetPos === null || stopAt < targetPos)) targetPos = stopAt;
        }
      }

      const nextStop = train.stops[train.nextStopIndex];
      if (nextStop) {
        const idx = train.path.indexOf(nextStop.sectionId);
        if (idx >= 0 && cum[idx] + this.sectionById.get(nextStop.sectionId)!.length * 0.8 > train.pos) {
          if (targetPos === null || nextStop.stopPos < targetPos) targetPos = nextStop.stopPos;
        }
      }

      const maxSpeed = this.maxSpeedFor(train);
      let desired = maxSpeed;
      if (targetPos !== null) {
        const dist = targetPos - train.pos;
        if (dist <= 0.01) {
          desired = 0;
        } else {
          desired = Math.min(Math.sqrt(Math.max(0, 2 * BRAKE * (dist - 0.4))), maxSpeed);
        }
      }
      if (desired < train.speed) {
        train.speed = Math.max(0, train.speed - BRAKE * dt);
      } else {
        train.speed = Math.min(desired, train.speed + ACCEL * dt);
      }
      train.pos += train.speed * dt;
      if (targetPos !== null && train.pos >= targetPos) {
        train.pos = targetPos;
        train.speed = 0;
      }

      if (train.pos > train.totalLength + 10) {
        train.exited = true;
        train.state = 'completed';
        const boundary = this.map.boundaries.find((b) => b.id === train.exitBoundary);
        this.logMessage('ok', `${train.headcode} exited at ${boundary?.name ?? train.exitBoundary}`);
        continue;
      }

      const stop = train.stops[train.nextStopIndex];
      if (stop && !train.dwellUntil && Math.abs(train.pos - stop.stopPos) < 1.5 && train.speed < 0.5) {
        const station = this.map.stations.find((s) => s.id === stop.stationId);
        train.dwellUntil = Math.max(stop.dep, this.clock);
        train.state = 'dwelling';
        this.logMessage('info', `${train.headcode} arrived ${station?.name ?? stop.stationId} (${train.line})`);
        continue;
      }

      if (train.pos > 0 && train.state === 'approaching') train.state = 'en-route';
      else if (train.speed < 0.05 && train.state === 'en-route') train.state = 'waiting';
      else if (train.speed >= 0.05 && train.state === 'waiting') train.state = 'en-route';
    }
  }

  private updateOccupancy() {
    this.occupied.clear();
    for (const train of this.trains) {
      if (!train.entered || train.exited) continue;
      const front = train.pos;
      const rear = train.pos - TRAIN_LENGTH;
      const cum = this.cumDistances(train);
      for (let i = 0; i < train.path.length; i++) {
        const sec = this.sectionById.get(train.path[i])!;
        const start = cum[i];
        const end = start + sec.length;
        if (front > start && rear < end) {
          this.occupied.set(sec.id, (this.occupied.get(sec.id) ?? 0) + 1);
        }
      }
    }
  }

  private computeAspects() {
    this.aspectCache.clear();
    for (const sig of this.map.signals) {
      this.aspects.set(sig.id, this.aspectOf(sig.id, new Set()));
    }
  }

  private aspectOf(sigId: string, visiting: Set<string>): Aspect {
    const cached = this.aspectCache.get(sigId);
    if (cached) return cached;
    if (visiting.has(sigId)) return 'red';
    visiting.add(sigId);
    const sig = this.signalById.get(sigId);
    if (!sig) return 'red';

    const sigRoutes = this.routesBySignal.get(sigId) ?? [];
    let pathSections: string[];
    let nextSigId: string | null;

    if (sigRoutes.length > 0) {
      const active = sigRoutes.find((r) => this.activeRoutes.has(r.id));
      if (!active) {
        this.aspectCache.set(sigId, 'red');
        return 'red';
      }
      pathSections = active.sections;
      nextSigId = active.toSignalId;
    } else {
      const ahead = this.lookAhead(sig);
      if (!ahead) {
        this.aspectCache.set(sigId, 'red');
        return 'red';
      }
      pathSections = ahead.sections;
      nextSigId = ahead.nextSignalId;
    }

    for (const secId of pathSections) {
      if ((this.occupied.get(secId) ?? 0) > 0) {
        this.aspectCache.set(sigId, 'red');
        return 'red';
      }
    }

    const nextAspect = nextSigId ? this.aspectOf(nextSigId, visiting) : 'green';
    const aspect: Aspect =
      nextAspect === 'red' ? 'yellow' : nextAspect === 'yellow' ? 'double-yellow' : 'green';
    this.aspectCache.set(sigId, aspect);
    return aspect;
  }

  private lookAhead(sig: SignalDef): { sections: string[]; nextSignalId: string | null } | null {
    const sections: string[] = [sig.guards];
    let current = sig.guards;
    for (let guard = 0; guard < 80; guard++) {
      const sec = this.sectionById.get(current);
      if (!sec) return null;
      const node = this.nodeById.get(sec.to);
      if (!node) return null;
      const nextSig = this.signalByNode.get(node.id);
      if (nextSig && nextSig.id !== sig.id) {
        return { sections, nextSignalId: nextSig.id };
      }
      const transitions = node.transitions.filter((t) => t.inSection === current);
      const chosen = transitions.find(
        (t) => !t.pointId || this.pointPositions.get(t.pointId) === t.requires,
      );
      if (!chosen) {
        if (transitions.length === 0) return { sections, nextSignalId: null };
        return null;
      }
      current = chosen.outSection;
      sections.push(current);
      if (!this.sectionById.has(current)) return null;
    }
    return null;
  }

  private updateRoutes() {
    for (const [routeId, state] of this.activeRoutes) {
      const route = this.routeById.get(routeId);
      if (!route) continue;
      const anyOccupied = route.sections.some((s) => (this.occupied.get(s) ?? 0) > 0);
      if (anyOccupied) {
        state.touched = true;
      } else if (state.touched) {
        this.activeRoutes.delete(routeId);
        const sig = this.signalById.get(route.signalId);
        this.logMessage('info', `Route ${route.description} at ${sig?.label ?? route.signalId} released`);
      }
    }
  }

  requestRoute(signalId: string, routeId: string): { ok: boolean; reason?: string } {
    const sig = this.signalById.get(signalId);
    const route = this.routeById.get(routeId);
    if (!sig || !route || route.signalId !== signalId) return { ok: false, reason: 'Unknown route' };
    const sigRoutes = this.routesBySignal.get(signalId) ?? [];
    if (sigRoutes.some((r) => this.activeRoutes.has(r.id))) {
      return { ok: false, reason: 'A route is already set at this signal — cancel it first' };
    }
    for (const secId of route.sections) {
      if ((this.occupied.get(secId) ?? 0) > 0) {
        return { ok: false, reason: `Section ${secId} is occupied` };
      }
    }
    for (const p of route.points) {
      for (const [otherId] of this.activeRoutes) {
        const other = this.routeById.get(otherId)!;
        const conflict = other.points.find((op) => op.pointId === p.pointId && op.pos !== p.pos);
        if (conflict) {
          const otherSig = this.signalById.get(other.signalId);
          return { ok: false, reason: `Conflicts with route at ${otherSig?.label ?? other.signalId}` };
        }
      }
    }
    const myDiags = new Set(route.sections.filter((s) => this.sectionById.get(s)?.kind === 'diagonal').map((s) => this.sectionById.get(s)!.crossover));
    for (const [otherId] of this.activeRoutes) {
      const other = this.routeById.get(otherId)!;
      for (const secId of other.sections) {
        const sec = this.sectionById.get(secId);
        if (sec?.kind === 'diagonal' && myDiags.has(sec.crossover) && !route.sections.includes(secId)) {
          const otherSig = this.signalById.get(other.signalId);
          return { ok: false, reason: `Conflicts with opposing movement at ${otherSig?.label ?? other.signalId}` };
        }
      }
    }
    for (const p of route.points) {
      const current = this.pointPositions.get(p.pointId);
      if (current !== p.pos) {
        this.pointPositions.set(p.pointId, p.pos);
        this.logMessage('info', `Point ${p.pointId} set to ${p.pos}`);
      }
    }
    this.activeRoutes.set(routeId, { touched: false });
    this.logMessage('ok', `Route set: ${sig.label} — ${route.description}`);
    this.computeAspects();
    return { ok: true };
  }

  cancelRoute(routeId: string): { ok: boolean; reason?: string } {
    const route = this.routeById.get(routeId);
    if (!route || !this.activeRoutes.has(routeId)) return { ok: false, reason: 'Route not set' };
    for (const secId of route.sections) {
      if ((this.occupied.get(secId) ?? 0) > 0) {
        return { ok: false, reason: 'Cannot cancel — route sections occupied' };
      }
    }
    this.activeRoutes.delete(routeId);
    const sig = this.signalById.get(route.signalId);
    this.logMessage('warn', `Route cancelled: ${sig?.label ?? route.signalId} — ${route.description}`);
    this.computeAspects();
    return { ok: true };
  }

  setPoint(pointId: string, pos: PointPos): { ok: boolean; reason?: string } {
    const point = this.map.points.find((p) => p.id === pointId);
    if (!point) return { ok: false, reason: 'Unknown point' };
    for (const [routeId] of this.activeRoutes) {
      const route = this.routeById.get(routeId)!;
      if (route.points.some((p) => p.pointId === pointId)) {
        const sig = this.signalById.get(route.signalId);
        return { ok: false, reason: `Point locked by route at ${sig?.label ?? route.signalId}` };
      }
    }
    this.pointPositions.set(pointId, pos);
    this.logMessage('info', `Point ${pointId} set to ${pos}`);
    this.computeAspects();
    return { ok: true };
  }

  select(kind: SimSnapshot['selected']['kind'], id: string | null) {
    this.selection = { kind, id };
  }

  private logMessage(kind: LogEntry['kind'], message: string) {
    this.log.push({ t: this.clock, kind, message });
    if (this.log.length > MAX_LOG) this.log.shift();
  }

  private maxSpeedFor(train: Train): number {
    const sch = this.schedules.find((s) => s.headcode === train.headcode && s.line === train.line);
    return sch?.maxSpeed ?? 25;
  }

  getSnapshot(): SimSnapshot {
    const trains: TrainSnapshot[] = this.trains.map((tr) => {
      let sectionId: string | null = null;
      const cum = this.cumDistances(tr);
      for (let i = tr.path.length - 1; i >= 0; i--) {
        if (tr.pos >= cum[i]) {
          sectionId = tr.path[i];
          break;
        }
      }
      const nextStop = tr.stops[tr.nextStopIndex];
      const station = nextStop ? this.map.stations.find((s) => s.id === nextStop.stationId) : null;
      const late = nextStop ? this.clock > nextStop.arr + 60 : false;
      return {
        uid: tr.uid,
        headcode: tr.headcode,
        description: tr.description,
        line: tr.line,
        direction: tr.direction,
        state: tr.state,
        pos: tr.pos,
        speed: tr.speed,
        sectionId,
        nextStop: station?.name ?? null,
        late,
      };
    });
    return {
      clock: this.clock,
      running: this.running,
      speed: this.speed,
      occupied: Object.fromEntries(this.occupied),
      aspects: Object.fromEntries(this.aspects),
      pointPositions: Object.fromEntries(this.pointPositions),
      routes: [...this.activeRoutes.keys()].map((id) => {
        const r = this.routeById.get(id)!;
        const sig = this.signalById.get(r.signalId);
        return { routeId: id, signalId: r.signalId, description: `${sig?.label ?? r.signalId}: ${r.description}` };
      }),
      trains,
      log: [...this.log],
      selected: this.selection,
    };
  }

  getTrainPositions(): { uid: number; pos: number; path: string[]; lengths: number[] }[] {
    return this.trains.map((t) => ({ uid: t.uid, pos: t.pos, path: t.path, lengths: t.pathLengths }));
  }

  getTrainDetail(uid: number) {
    const t = this.trains.find((x) => x.uid === uid);
    if (!t) return null;
    return {
      headcode: t.headcode,
      description: t.description,
      line: t.line,
      direction: t.direction,
      origin: t.origin,
      destination: t.destination,
      state: t.state,
      speed: t.speed,
      pos: t.pos,
      totalLength: t.totalLength,
      stops: t.stops.map((s) => ({
        station: this.map.stations.find((st) => st.id === s.stationId)?.name ?? s.stationId,
        arr: s.arr,
        dep: s.dep,
        done: t.stops.indexOf(s) < t.nextStopIndex,
      })),
    };
  }

  getRoutesForSignal(signalId: string) {
    return (this.routesBySignal.get(signalId) ?? []).map((r) => ({
      routeId: r.id,
      description: r.description,
      toSignalId: r.toSignalId,
      set: this.activeRoutes.has(r.id),
    }));
  }
}

