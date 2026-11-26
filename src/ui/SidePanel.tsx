import { useState } from 'react';
import type { PointPos, SimSnapshot, TrainSchedule } from '../engine/types';
import type { Simulation } from '../engine/Simulation';
import { fmtHM } from './format';

function useActionError() {
  const [error, setError] = useState<string | null>(null);
  return { error, setError };
}

interface Props {
  snap: SimSnapshot;
  timetable: TrainSchedule[];
  sim: Simulation;
  onSelectTrain: (uid: number) => void;
  onAction: () => void;
}

const STATE_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  approaching: 'Approaching',
  'en-route': 'En route',
  dwelling: 'Dwelling',
  waiting: 'Waiting',
  completed: 'Completed',
};

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
            <div key={r.routeId} className="route-row">
              <span>{r.description}{r.set ? ' ✓' : ''}</span>
              {r.set ? (
                <button
                  className="mini-btn"
                  onClick={() => {
                    sim.cancelRoute(r.routeId);
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
  return (
    <div className="selection-card">
      <h3>
        {detail.headcode} — {detail.description}
      </h3>
      <div className="kv"><span>Route</span><span>{detail.origin} → {detail.destination}</span></div>
      <div className="kv"><span>Line</span><span>{detail.line} ({detail.direction === 'up' ? 'Up' : 'Down'})</span></div>
      <div className="kv"><span>Status</span><span>{STATE_LABEL[detail.state] ?? detail.state} · {detail.speed.toFixed(0)} m/s</span></div>
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

export function SidePanel({ snap, timetable, sim, onSelectTrain, onAction }: Props) {
  const [tab, setTab] = useState<'timetable' | 'selection'>('timetable');
  const uidByHeadcode = new Map(snap.trains.map((t) => [t.headcode, t.uid]));

  return (
    <aside className="side-panel">
      <div className="side-tabs">
        <button className={`side-tab ${tab === 'timetable' ? 'side-tab-active' : ''}`} onClick={() => setTab('timetable')}>
          Timetable
        </button>
        <button className={`side-tab ${tab === 'selection' ? 'side-tab-active' : ''}`} onClick={() => setTab('selection')}>
          Selection
        </button>
      </div>
      <div className="side-body">
        {tab === 'timetable' && (
          <table className="timetable">
            <thead>
              <tr>
                <th>Headcode</th>
                <th>Service</th>
                <th>Route</th>
                <th>Calls</th>
                <th>Line</th>
                <th>In</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {timetable.map((sch) => {
                const live = snap.trains.find((t) => t.headcode === sch.headcode);
                const uid = uidByHeadcode.get(sch.headcode);
                const selected = snap.selected.kind === 'train' && snap.selected.id === String(uid);
                const stationName = (id: string) => sim.map.stations.find((s) => s.id === id)?.name ?? id;
                const calls = sch.stops.map((s) => `${stationName(s.stationId)} ${fmtHM(s.arr)}/${fmtHM(s.dep)}`).join('  ·  ');
                return (
                  <tr
                    key={sch.headcode}
                    className={selected ? 'row-selected' : live?.late ? 'row-late' : ''}
                    onClick={() => uid !== undefined && onSelectTrain(uid)}
                  >
                    <td className="td-headcode">{sch.headcode}</td>
                    <td>{sch.description}</td>
                    <td>{sch.origin} → {sch.destination}</td>
                    <td className="td-calls">{calls}</td>
                    <td>{sch.line} {sch.direction === 'up' ? '↑' : '↓'}</td>
                    <td>{fmtHM(sch.entryTime)}</td>
                    <td>{live ? STATE_LABEL[live.state] ?? live.state : 'Scheduled'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
