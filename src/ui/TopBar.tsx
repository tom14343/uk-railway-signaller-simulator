import { fmtClock } from './format';

interface Props {
  clock: number;
  running: boolean;
  speed: number;
  onToggle: () => void;
  onSpeed: (s: number) => void;
  onReset: () => void;
}

const SPEEDS = [1, 2, 4, 8, 16];

export function TopBar({ clock, running, speed, onToggle, onSpeed, onReset }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="topbar-area">Adamfield</span>
        <span className="topbar-sub">Signalling Area</span>
      </div>
      <div className="topbar-status">
        <span className={`status-pill ${running ? 'status-running' : 'status-paused'}`}>
          {running ? 'RUNNING' : 'PAUSED'}
        </span>
        <span className="clock">{fmtClock(clock)}</span>
      </div>
      <div className="topbar-controls">
        <div className="speed-group">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`speed-btn ${speed === s ? 'speed-active' : ''}`}
              onClick={() => onSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
        <button className="ctrl-btn" onClick={onToggle}>
          {running ? '❚❚ Pause' : '▶ Start'}
        </button>
        <button className="ctrl-btn ctrl-reset" onClick={onReset}>
          Reset
        </button>
      </div>
    </header>
  );
}
