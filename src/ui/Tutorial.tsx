import { useEffect, useMemo, useState } from 'react';
import type { SimSnapshot } from '../engine/types';
import type { Simulation } from '../engine/Simulation';
import type { DrawerTab } from './Drawer';

interface TutCtx {
  sim: Simulation;
  snap: SimSnapshot;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
}

interface TutStep {
  title: string;
  body: string[];
  target?: string[];
  task?: string;
  done?: (ctx: TutCtx) => boolean;
  onEnter?: (ctx: TutCtx) => void;
}

interface Lesson {
  title: string;
  steps: TutStep[];
}

const PREROLL_TARGET = 6 * 3600 + 25 * 60;

function trainByHeadcode(snap: SimSnapshot, headcode: string) {
  return snap.trains.find((t) => t.headcode === headcode);
}

const LESSONS: Lesson[] = [
  {
    title: 'Welcome to Adamfield',
    steps: [
      {
        title: 'Your role',
        body: [
          'Welcome to the Adamfield signalling area. In this simulation you are the signaller responsible for a stretch of four-aspect colour-light signalling territory.',
          'A signaller keeps trains apart safely: setting routes, operating points, and making sure every signal shows the correct aspect for the state of the railway ahead.',
        ],
        target: ['diagram'],
      },
      {
        title: 'The track diagram',
        body: [
          'The large diagram is your signalling panel. Each horizontal line is a running line of track; stations appear as platforms along them.',
          'Signals appear beside the lines with their current aspect lit. Points appear as small switches. Occupied track sections are highlighted red.',
        ],
        target: ['diagram'],
      },
      {
        title: 'Up, Down, Fast and Slow',
        body: [
          'The four running lines are: Up Fast, Up Slow, Down Slow and Down Fast. "Up" trains travel left to right; "Down" trains travel right to left.',
          'Fast lines carry express services; Slow lines carry stopping services and local traffic. Trains keep to their assigned line unless you set a route that diverges.',
        ],
        target: ['line-UF', 'line-US', 'line-DS', 'line-DF'],
      },
    ],
  },
  {
    title: 'Understanding the signalling diagram',
    steps: [
      {
        title: 'Running lines and stations',
        body: [
          'The four parallel tracks are the running lines. The three stations — Marshfield, Adamfield and Brackenhill — each have platforms serving all four lines.',
          'The dashed vertical lines at each end are the boundary locations Norton and Harrowgate, where trains enter and leave your area.',
        ],
        target: ['station-marshfield', 'station-adamfield', 'station-brackenhill'],
      },
      {
        title: 'Signals',
        body: [
          'Signals stand beside the line at the start of each block section. The lit lamp shows the aspect the driver sees. Labels identify each signal, e.g. UF-S1E.',
          'Click a signal to inspect it and see the routes available from it.',
        ],
        target: ['signal-SIG.UF.S1E'],
      },
      {
        title: 'Points',
        body: [
          'Points are the switches that let a train transfer between lines at a crossover. Each shows N (normal) or R (reverse).',
          'Points are normally set by routes; they can also be operated manually when not locked by a route.',
        ],
        target: ['point-pt.UF.c1'],
      },
      {
        title: 'Track sections and occupancy',
        body: [
          'The railway is divided into track sections (block sections). A section turns red on the diagram while a train occupies it.',
          'Signals cannot clear into an aspect that would allow a train into an occupied section — this is what keeps trains apart.',
        ],
        target: ['css:[data-occupied="true"]', 'section-UF.s5'],
      },
    ],
  },
  {
    title: 'Understanding signals',
    steps: [
      {
        title: 'The four aspects',
        body: [
          'Adamfield uses four-aspect colour-light signalling. Green means clear — proceed. Double yellow is a preliminary caution: the next signal is at single yellow. Single yellow is a caution: the next signal is at red. Red means stop.',
          'Aspects are not set by hand — they are calculated from the state of the railway ahead: occupancy and the aspect of the next signal.',
        ],
        target: ['signal-SIG.UF.S1E', 'signal-SIG.UF.W'],
      },
      {
        title: 'Reading an aspect cascade',
        body: [
          'Watch the signals approach a red: further back they show green, then double yellow, then single yellow, then red. This gives drivers warning time to brake.',
          'Look along the Up Fast line — signals ahead of any held train will show this progression.',
        ],
        target: ['line-UF'],
      },
      {
        title: 'Signals at danger',
        body: [
          'A signal at red must never be passed. In this area, junction signals also remain at red until you set a route for them — that is your main task as signaller.',
          'Select signal UF-S1E to see its routes in the Selection panel.',
        ],
        target: ['signal-SIG.UF.S1E', 'drawer-selection-tab'],
      },
    ],
  },
  {
    title: 'Trains and the timetable',
    steps: [
      {
        title: 'The trains panel',
        body: [
          'Every scheduled train appears in the Trains panel with its headcode (reporting number), service type, route, running line and entry time.',
          'Open the Trains tab if it is not already visible.',
        ],
        target: ['drawer', 'drawer-trains-tab'],
        task: 'Open the Trains panel',
        done: (ctx) => ctx.drawerOpen && ctx.drawerTab === 'trains',
      },
      {
        title: 'Finding a service',
        body: [
          'Find train 1A01 — an express passenger service from Norton to Harrowgate on the Up Fast line, calling at Adamfield.',
          'Click its row to identify it on the diagram.',
        ],
        target: ['tt-1A01', 'train-1A01'],
        task: 'Select train 1A01',
        done: (ctx) => {
          const sel = ctx.snap.selected;
          if (sel.kind !== 'train' || !sel.id) return false;
          const t = ctx.snap.trains.find((x) => String(x.uid) === sel.id);
          return t?.headcode === '1A01';
        },
      },
      {
        title: 'Reading the service',
        body: [
          'The Selection panel shows the train\'s origin, destination, running line, status and scheduled calls with arrival and departure times.',
          'On the diagram the train appears as a labelled block. Occupied sections it covers show red.',
        ],
        target: ['drawer', 'train-1A01'],
      },
    ],
  },
  {
    title: 'Setting a route',
    steps: [
      {
        title: 'Why routes are needed',
        body: [
          'Signal UF-S1E protects the junction at Marshfield where trains can continue on Up Fast or diverge to Up Slow. It stays at red until you set a route.',
          'Train 1A01 is currently waiting at this signal. Setting a route tells the interlocking which path to clear and locks the points accordingly.',
        ],
        target: ['signal-SIG.UF.S1E', 'train-1A01'],
      },
      {
        title: 'Select the signal',
        body: [
          'Click signal UF-S1E on the diagram. Its details and available routes appear in the Selection panel.',
        ],
        target: ['signal-SIG.UF.S1E', 'drawer-selection-tab'],
        task: 'Select signal UF-S1E',
        done: (ctx) => ctx.snap.selected.kind === 'signal' && ctx.snap.selected.id === 'SIG.UF.S1E',
      },
      {
        title: 'Choose a route',
        body: [
          'Two routes are available: "Proceed" keeps the train on Up Fast; "Diverge via US" would send it onto Up Slow. For 1A01, choose Proceed.',
          'Press Set on the Proceed route.',
        ],
        target: ['route-RT.SIG.UF.S1E.1', 'drawer'],
        task: 'Set the Proceed route at UF-S1E',
        done: (ctx) => ctx.snap.routes.some((r) => r.signalId === 'SIG.UF.S1E'),
      },
      {
        title: 'Route set',
        body: [
          'The route is now set: the points are locked in position and the signal can clear. Watch UF-S1E — it will show a proceed aspect once the route ahead is clear.',
          'If a route is refused, the reason is shown — usually an occupied section or a conflicting route. Cancel a set route with its Cancel button when needed.',
        ],
        target: ['signal-SIG.UF.S1E', 'route-RT.SIG.UF.S1E.1'],
      },
    ],
  },
  {
    title: 'Points and track occupancy',
    steps: [
      {
        title: 'What points do',
        body: [
          'Points are the switches at each crossover. "Normal" keeps a train on its own line; "Reverse" diverts it across to the adjacent line.',
          'A route automatically sets the points it needs and locks them until the movement is complete. While locked, manual operation is refused.',
        ],
        target: ['point-pt.UF.c1', 'point-pt.US.c1a'],
      },
      {
        title: 'Inspect a point',
        body: [
          'Click point pt.US.c1a on the diagram to inspect it — the Selection panel shows its position and lets you operate it when it is not locked.',
        ],
        target: ['point-pt.US.c1a', 'drawer-selection-tab'],
        task: 'Select a point on the diagram',
        done: (ctx) => ctx.snap.selected.kind === 'point',
      },
      {
        title: 'Occupancy and conflicts',
        body: [
          'A route cannot be set through an occupied section — the request is refused with the reason shown. This is what prevents two trains being routed into the same block.',
          'Routes that would drive opposing movements across the same crossover are also rejected as conflicting.',
        ],
        target: ['css:[data-occupied="true"]', 'drawer'],
      },
    ],
  },
  {
    title: 'Running the simulation',
    steps: [
      {
        title: 'Clock, pause and speed',
        body: [
          'The clock shows simulation time. Use Pause/Start to halt or resume the simulation, and the speed buttons to run it faster. The event log records train movements and route actions.',
          'For this exercise, set the speed to 4× so you can watch the train move.',
        ],
        target: ['topbar-clock', 'topbar-pause', 'topbar-speeds'],
        task: 'Set simulation speed above 1×',
        done: (ctx) => ctx.snap.speed > 1,
        onEnter: (ctx) => ctx.sim.pause(),
      },
      {
        title: 'Start the simulation',
        body: [
          'Press Start (or Play) to resume the simulation. Trains will now move, dwell at stations and wait at signals that have no route.',
        ],
        target: ['topbar-pause'],
        task: 'Start the simulation',
        done: (ctx) => ctx.snap.running,
      },
      {
        title: 'Signal the train through Adamfield',
        body: [
          'Train 1A01 is approaching or dwelling at Adamfield. Its departure signal is UF-S2E. Set a route at UF-S2E so it can depart.',
          'You can set the route now or when the train is alongside — either way it must be set before the signal can clear.',
        ],
        target: ['signal-SIG.UF.S2E', 'drawer-selection-tab'],
        task: 'Set a route at UF-S2E',
        done: (ctx) => ctx.snap.routes.some((r) => r.signalId === 'SIG.UF.S2E'),
      },
      {
        title: 'Watch it depart',
        body: [
          'With the route set, watch 1A01 depart Adamfield and continue towards Harrowgate. The route will release automatically once the train has cleared it.',
        ],
        target: ['train-1A01', 'signal-SIG.UF.S2E'],
        task: 'Wait for 1A01 to depart Adamfield',
        done: (ctx) => {
          const t = trainByHeadcode(ctx.snap, '1A01');
          return !!t && t.state === 'en-route' && t.nextStop === null;
        },
      },
      {
        title: 'Tutorial complete',
        body: [
          'Well done — you have set routes, operated points and kept a train moving safely. You can continue in Free Play with the same railway state, restart the tutorial, or return to the main menu.',
        ],
        target: ['diagram'],
      },
    ],
  },
];

interface Props {
  sim: Simulation;
  snap: SimSnapshot;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
  onExit: () => void;
  onFreePlay: () => void;
  onRestartSim: () => void;
}

export function Tutorial({ sim, snap, drawerTab, drawerOpen, onExit, onFreePlay, onRestartSim }: Props) {
  const [phase, setPhase] = useState<'pre' | 'run' | 'done'>('pre');
  const [lessonIdx, setLessonIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  const ctx: TutCtx = useMemo(() => ({ sim, snap, drawerTab, drawerOpen }), [sim, snap, drawerTab, drawerOpen]);

  useEffect(() => {
    if (phase !== 'pre') return;
    sim.setSpeed(16);
    sim.start();
    if (snap.clock >= PREROLL_TARGET) {
      sim.pause();
      sim.setSpeed(1);
      setPhase('run');
    }
  }, [phase, sim, snap.clock]);

  const lesson = LESSONS[lessonIdx];
  const step = lesson?.steps[stepIdx];

  useEffect(() => {
    if (!step?.target) return;
    const els: Element[] = [];
    for (const t of step.target) {
      const sel = t.startsWith('css:') ? t.slice(4) : `[data-tut="${t}"]`;
      document.querySelectorAll(sel).forEach((el) => {
        el.classList.add('tut-hl');
        els.push(el);
      });
    }
    return () => els.forEach((el) => el.classList.remove('tut-hl'));
  }, [lessonIdx, stepIdx, phase]);

  useEffect(() => {
    step?.onEnter?.(ctx);
  }, [lessonIdx, stepIdx]);

  if (phase === 'pre') {
    return (
      <div className="tut-overlay">
        <div className="tut-card">
          <h2>Preparing Adamfield…</h2>
          <p className="muted">Running the railway up to the tutorial point.</p>
        </div>
      </div>
    );
  }

  if (phase === 'done' || !lesson || !step) {
    return (
      <div className="tut-overlay">
        <div className="tut-card">
          <h2>Tutorial complete</h2>
          <p>You have completed all seven lessons on the Adamfield signalling area.</p>
          <div className="tut-actions">
            <button className="menu-btn menu-btn-primary" onClick={onFreePlay}>Continue in Free Play</button>
            <button className="menu-btn" onClick={onRestartSim}>Restart Tutorial</button>
            <button className="menu-btn" onClick={onExit}>Main Menu</button>
          </div>
        </div>
      </div>
    );
  }

  const isLastStep = stepIdx === lesson.steps.length - 1;
  const isLastLesson = lessonIdx === LESSONS.length - 1;
  const taskDone = !step.task || (step.done?.(ctx) ?? false);

  const goNext = () => {
    if (!taskDone) return;
    if (isLastStep && isLastLesson) {
      setPhase('done');
      return;
    }
    if (isLastStep) {
      setLessonIdx((i) => i + 1);
      setStepIdx(0);
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  const goBack = () => {
    if (stepIdx > 0) {
      setStepIdx((i) => i - 1);
    } else if (lessonIdx > 0) {
      setLessonIdx((i) => i - 1);
      setStepIdx(LESSONS[lessonIdx - 1].steps.length - 1);
    }
  };

  const skipLesson = () => {
    if (lessonIdx < LESSONS.length - 1) {
      setLessonIdx((i) => i + 1);
      setStepIdx(0);
    } else {
      setPhase('done');
    }
  };

  const restart = () => {
    onRestartSim();
  };

  return (
    <div className="tut-overlay">
      <div className="tut-card">
        <div className="tut-progress">
          Lesson {lessonIdx + 1} of {LESSONS.length} — {lesson.title}
        </div>
        <h3>{step.title}</h3>
        {step.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {step.task && (
          <div className={`tut-task ${taskDone ? 'tut-task-done' : ''}`}>
            {taskDone ? '✓ ' : '▸ '}{step.task}
            {!taskDone && <span className="tut-wait"> — waiting for you…</span>}
          </div>
        )}
        <div className="tut-actions">
          <button className="mini-btn" onClick={goBack} disabled={lessonIdx === 0 && stepIdx === 0}>Back</button>
          <button className="mini-btn" onClick={skipLesson}>Skip lesson</button>
          <button className="mini-btn" onClick={restart}>Restart tutorial</button>
          <button className="mini-btn" onClick={onExit}>Exit</button>
          <button className="mini-btn mini-btn-primary" onClick={goNext} disabled={!taskDone}>
            {isLastStep && isLastLesson ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
