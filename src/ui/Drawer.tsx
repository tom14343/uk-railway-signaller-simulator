import { useState } from 'react';
import type { PointPos, SimSnapshot, TrainSchedule } from '../engine/types';
import type { Simulation } from '../engine/Simulation';
import { fmtHM } from './format';

export type DrawerTab = 'trains' | 'selection';

interface Props {
  snap: SimSnapshot;
  timetable: TrainSchedule[];
  sim: Simulation;
  open: boolean;
  tab: DrawerTab;
  onToggle: () => void;
  onTab: (t: DrawerTab) => void;
  onSelectTrain: (uid: number) => void;
  onAction: () => void;
}

const STATE_LABEL: Record<string, string> = {
  scheduled: 'Sched',
  approaching: 'Appr',
  'en-route': 'Moving',
  dwelling: 'Stop',
  waiting: 'Hold',
  completed: 'Done',
};

function useActionError() {
  const [error, setError] = useState<string | null>(null);
  return { error, setError };
}

function SignalPanel({ sim, snap, onAction }: { sim: Simulation; snap: SimSnapshot; onAction: () => void }) {
  const sigId = snap.selected.id!;
  const sig = sim.map.signals.find((s) => s.id === sigId);
  const { error, setError } = useActionError();
  if (!sig) return null;
  const aspect = snap.aspects[sigId] ?? 'red';
  const routes = sim.getRoutesForSignal(sigId);
  const active = snap.routes.filter((r) => r.signalId === sigId);
  return (
    <div className="selection-card">
      <h3>Signal {sig.label}</h3>
      <div className="kv"><span>Aspect</span><span className={`aspect-text aspect-${aspect}`}>{aspect.toUpperCase()}</span></div>
      <div className="kv"><span>Line</span><span>{sig.line} ({sig.direction === 'up' ? 'Up' : 'Down'})</span></div>
      <div className="kv"><span>Guards</span><span>{sig.guards}</span></div>
      {routes.length === 0 && <div className="muted">Automatic signal — clears according to conditions ahead.</div>}
      {routes.length > 0 && (
        <div className="route-list">
          <div className="muted">Routes — select to set:</div>
          {routes.map((r) => (
            <div key={r.routeId} className="route-row" data-tut={`route-${r.routeId}`}>
              <span>{r.description}{r.set ? ' ✓' : ''}</span>
              {r.set ? (
                <button
                  className="mini-btn"
                  onClick={() => {
                    const res = sim.cancelRoute(r.routeId);
                    setError(res.ok ? null : res.reason ?? 'Refused');
                    onAction();
                  }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  className="mini-btn"
                  onClick={() => {
                    const res = sim.requestRoute(sigId, r.routeId);
                    setError(res.ok ? null : res.reason ?? 'Refused');
                    onAction();
                  }}
                >
                  Set
                </button>
              )}
            </div>
          ))}
          {active.length > 0 && <div className="muted">{active.length} route set — signal will clear when route is available.</div>}
          {error && <div className="action-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

function PointPanel({ sim, snap, onAction }: { sim: Simulation; snap: SimSnapshot; onAction: () => void }) {
  const pid = snap.selected.id!;
  const point = sim.map.points.find((p) => p.id === pid);
  const { error, setError } = useActionError();
  if (!point) return null;
  const pos = (snap.pointPositions[pid] ?? 'normal') as PointPos;
  const activeIds = new Set(snap.routes.map((r) => r.routeId));
  const locked = sim.map.routes.some((r) => activeIds.has(r.id) && r.points.some((p) => p.pointId === pid));
  return (
    <div className="selection-card">
      <h3>Point {point.label}</h3>
      <div className="kv"><span>Position</span><span>{pos === 'normal' ? 'Normal' : 'Reverse'}</span></div>
      <div className="point-btns">
        {(['normal', 'reverse'] as PointPos[]).map((p) => (
          <button
            key={p}
            className={`mini-btn ${pos === p ? 'mini-active' : ''}`}
            onClick={() => {
              const res = sim.setPoint(pid, p);
              if (!res.ok) setError(res.reason ?? 'Refused');
              onAction();
            }}
          >
            {p === 'normal' ? 'Normal' : 'Reverse'}
          </button>
        ))}
      </div>
      {locked && <div className="muted">Locked by a set route.</div>}
      {error && <div className="action-error">{error}</div>}
    </div>
  );
}

function TrainPanel({ sim, snap }: { sim: Simulation; snap: SimSnapshot }) {
  const uid = Number(snap.selected.id);
  const detail = sim.getTrainDetail(uid);
  if (!detail) return null;
  const sch = sim.getSchedule(detail.headcode);
  return (
    <div className="selection-card">
      <h3>
        {detail.headcode} — {detail.description}
      </h3>
      <div className="kv"><span>Route</span><span>{detail.origin} → {detail.destination}</span></div>
      <div className="kv"><span>Line</span><span>{detail.line} ({detail.direction === 'up' ? 'Up' : 'Down'})</span></div>
      <div className="kv"><span>Status</span><span>{STATE_LABEL[detail.state] ?? detail.state} · {detail.speed.toFixed(0)} m/s</span></div>
      {sch && (
        <>
          <div className="kv"><span>Entry</span><span>{sch.origin} {fmtHM(sch.entryTime)}</span></div>
          <div className="kv"><span>Exit</span><span>{sch.destination}</span></div>
        </>
      )}
      <div className="stop-list">
        {detail.stops.map((s, i) => (
          <div key={i} className={`stop-row ${s.done ? 'stop-done' : ''}`}>
            <span>{s.station}</span>
            <span>{fmtHM(s.arr)} / {fmtHM(s.dep)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Drawer({ snap, timetable, sim, open, tab, onToggle, onTab, onSelectTrain, onAction }: Props) {
  const uidByHeadcode = new Map(snap.trains.map((t) => [t.headcode, t.uid]));

  if (!open) {
    return (
      <div className="drawer-rail">
        <button className="rail-btn" onClick={onToggle} title="Open panels" data-tut="drawer-toggle">◂</button>
        <button className="rail-btn" onClick={() => { onTab('trains'); onToggle(); }} title="Trains">TR</button>
        <button className="rail-btn" onClick={() => { onTab('selection'); onToggle(); }} title="Selection">SL</button>
      </div>
    );
  }

  return (
    <aside className="side-panel" data-tut="drawer">
      <div className="drawer-head">
        <div className="side-tabs">
          <button className={`side-tab ${tab === 'trains' ? 'side-tab-active' : ''}`} onClick={() => onTab('trains')} data-tut="drawer-trains-tab">
            Trains
          </button>
          <button className={`side-tab ${tab === 'selection' ? 'side-tab-active' : ''}`} onClick={() => onTab('selection')} data-tut="drawer-selection-tab">
            Selection
          </button>
        </div>
        <button className="drawer-close" onClick={onToggle} title="Close panels">▸</button>
      </div>
      <div className="side-body">
        {tab === 'trains' && (
          <div className="train-list">
            {timetable.map((sch) => {
              const live = snap.trains.find((t) => t.headcode === sch.headcode);
              const uid = uidByHeadcode.get(sch.headcode);
              const selected = snap.selected.kind === 'train' && snap.selected.id === String(uid);
              const stateKey = live?.state ?? 'scheduled';
              return (
                <div
                  key={sch.headcode}
                  className={`train-row ${selected ? 'row-selected' : ''} ${live?.late ? 'row-late' : ''}`}
                  data-tut={`tt-${sch.headcode}`}
                  onClick={() => {
                    if (uid !== undefined) {
                      onSelectTrain(uid);
                      onTab('selection');
                    }
                  }}
                >
                  <span className="tr-headcode">{sch.headcode}</span>
                  <span className="tr-desc">{sch.description.replace(' Passenger', '')}</span>
                  <span className="tr-route">{sch.origin}→{sch.destination}</span>
                  <span className="tr-line">{sch.line}{sch.direction === 'up' ? '↑' : '↓'}</span>
                  <span className="tr-time">{fmtHM(sch.entryTime)}</span>
                  <span className={`tr-state st-${stateKey}`}>{STATE_LABEL[stateKey] ?? stateKey}</span>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'selection' && (
          <div className="selection-wrap">
            {!snap.selected.id && <div className="muted">Select a signal, point or train on the diagram.</div>}
            {snap.selected.kind === 'signal' && <SignalPanel sim={sim} snap={snap} onAction={onAction} />}
            {snap.selected.kind === 'point' && <PointPanel sim={sim} snap={snap} onAction={onAction} />}
            {snap.selected.kind === 'train' && <TrainPanel sim={sim} snap={snap} />}
          </div>
        )}
      </div>
    </aside>
  );
}
