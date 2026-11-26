import { useEffect, useMemo, useState } from 'react';
import { Simulation } from './engine/Simulation';
import { buildAdamfield } from './maps/adamfield';
import { TrackDiagram } from './ui/TrackDiagram';
import { TopBar } from './ui/TopBar';
import { SidePanel } from './ui/SidePanel';
import { BottomPanel } from './ui/BottomPanel';
import { computeTrainGeometry } from './ui/geometry';

const ADAMFIELD = buildAdamfield();

function createSim() {
  return new Simulation(ADAMFIELD.map, ADAMFIELD.timetable);
}

export default function App() {
  const [sim, setSim] = useState<Simulation>(() => createSim());
  const [, setFrame] = useState(0);

  useEffect(() => {
    sim.start();
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
  }, [sim]);

  const snap = sim.getSnapshot();

  const trainGeom = useMemo(() => {
    const positions = sim.getTrainPositions().filter((t) => {
      const ts = snap.trains.find((x) => x.uid === t.uid);
      return ts && ts.state !== 'completed' && ts.state !== 'scheduled';
    });
    return computeTrainGeometry(ADAMFIELD.map, positions);
  }, [sim, snap]);

  const handleSelect = (kind: 'signal' | 'point' | 'train' | null, id: string | null) => {
    sim.select(kind, id);
    setFrame((f) => f + 1);
  };

  const handleReset = () => {
    setSim(createSim());
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
      />
      <div className="main-area">
        <div className="diagram-wrap">
          <TrackDiagram map={ADAMFIELD.map} snap={snap} trainGeom={trainGeom} onSelect={handleSelect} />
        </div>
        <SidePanel
          snap={snap}
          timetable={ADAMFIELD.timetable}
          sim={sim}
          onSelectTrain={(uid) => handleSelect('train', String(uid))}
          onAction={() => setFrame((f) => f + 1)}
        />
      </div>
      <BottomPanel log={snap.log} />
    </div>
  );
}
