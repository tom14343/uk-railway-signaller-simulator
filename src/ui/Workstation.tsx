import { useEffect, useMemo, useState } from 'react';
import { Simulation } from '../engine/Simulation';
import { buildAdamfield } from '../maps/adamfield';
import type { Settings } from './settings';
import { TrackDiagram } from './TrackDiagram';
import { TopBar } from './TopBar';
import { Drawer, type DrawerTab } from './Drawer';
import { BottomPanel } from './BottomPanel';
import { Tutorial } from './Tutorial';
import { computeTrainGeometry } from './geometry';

const ADAMFIELD = buildAdamfield();

function createSim() {
  return new Simulation(ADAMFIELD.map, ADAMFIELD.timetable);
}

interface Props {
  mode: 'free' | 'tutorial';
  settings: Settings;
  onExit: () => void;
  onModeChange: (m: 'free' | 'tutorial') => void;
}

export function Workstation({ mode, settings, onExit, onModeChange }: Props) {
  const [sim, setSim] = useState<Simulation>(() => createSim());
  const [session, setSession] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('trains');
  const [, setFrame] = useState(0);

  useEffect(() => {
    if (mode === 'free') {
      sim.setSpeed(settings.defaultSpeed);
      sim.start();
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      sim.tick(dt);
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, mode, settings.defaultSpeed]);

  const snap = sim.getSnapshot();

  const routeTargets = useMemo(() => {
    const targets = new Set<string>();
    if (snap.selected.kind === 'signal' && snap.selected.id) {
      const setIds = new Set(snap.routes.map((r) => r.routeId));
      for (const r of ADAMFIELD.map.routes) {
        if (r.signalId === snap.selected.id && r.toSignalId && !setIds.has(r.id)) {
          targets.add(r.toSignalId);
        }
      }
    }
    return targets;
  }, [snap]);

  const trainGeom = useMemo(() => {
    const positions = sim.getTrainPositions().filter((t) => {
      const ts = snap.trains.find((x) => x.uid === t.uid);
      return ts && ts.state !== 'completed' && ts.state !== 'scheduled';
    });
    return computeTrainGeometry(ADAMFIELD.map, positions);
  }, [sim, snap]);

  const handleSelect = (kind: 'signal' | 'point' | 'train' | null, id: string | null) => {
    if (kind === 'signal' && id) {
      const sel = snap.selected;
      if (sel.kind === 'signal' && sel.id && sel.id !== id) {
        const setIds = new Set(snap.routes.map((r) => r.routeId));
        const route = ADAMFIELD.map.routes.find(
          (r) => r.signalId === sel.id && r.toSignalId === id && !setIds.has(r.id),
        );
        if (route) {
          sim.requestRoute(sel.id, route.id);
          setFrame((f) => f + 1);
          return;
        }
      }
    }
    sim.select(kind, id);
    if (kind === 'signal' || kind === 'point') {
      setDrawerTab('selection');
      setDrawerOpen(true);
    }
    setFrame((f) => f + 1);
  };

  const handleReset = () => {
    setSim(createSim());
    setSession((s) => s + 1);
  };

  return (
    <div className="app">
      <TopBar
        clock={snap.clock}
        running={snap.running}
        speed={snap.speed}
        onToggle={() => {
          sim.toggle();
          setFrame((f) => f + 1);
        }}
        onSpeed={(s) => {
          sim.setSpeed(s);
          setFrame((f) => f + 1);
        }}
        onReset={handleReset}
        onMenu={onExit}
      />
      <div className="main-area">
        <div className="diagram-wrap">
          <TrackDiagram
            map={ADAMFIELD.map}
            snap={snap}
            trainGeom={trainGeom}
            onSelect={handleSelect}
            showLabels={settings.showLabels}
            routeTargets={routeTargets}
          />
        </div>
        <Drawer
          snap={snap}
          timetable={ADAMFIELD.timetable}
          sim={sim}
          open={drawerOpen}
          tab={drawerTab}
          onToggle={() => setDrawerOpen((o) => !o)}
          onTab={setDrawerTab}
          onSelectTrain={(uid) => handleSelect('train', String(uid))}
          onAction={() => setFrame((f) => f + 1)}
        />
      </div>
      <BottomPanel log={snap.log} />
      {mode === 'tutorial' && (
        <Tutorial
          key={session}
          sim={sim}
          snap={snap}
          drawerTab={drawerTab}
          drawerOpen={drawerOpen}
          onExit={onExit}
          onFreePlay={() => onModeChange('free')}
          onRestartSim={handleReset}
        />
      )}
    </div>
  );
}
