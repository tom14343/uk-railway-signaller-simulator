import { fmtClock } from './format';

interface Props {
  clock: number;
  running: boolean;
  speed: number;
  onToggle: () => void;
  onSpeed: (s: number) => void;
  onReset: () => void;
  onMenu: () => void;
}

const SPEEDS = [1, 2, 4, 8, 16];

export function TopBar({ clock, running, speed, onToggle, onSpeed, onReset, onMenu }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="topbar-area">Adamfield</span>
        <span className="topbar-sub">Signalling Area</span>
      </div>
      <div className="topbar-status" data-tut="topbar-status">
        <span className={`status-pill ${running ? 'status-running' : 'status-paused'}`}>
          {running ? 'RUNNING' : 'PAUSED'}
        </span>
        <span className="clock" data-tut="topbar-clock">{fmtClock(clock)}</span>
      </div>
      <div className="topbar-controls">
        <div className="speed-group" data-tut="topbar-speeds">
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
        <button className="ctrl-btn" onClick={onToggle} data-tut="topbar-pause">
          {running ? '❚❚ Pause' : '▶ Start'}
        </button>
        <button className="ctrl-btn ctrl-reset" onClick={onReset}>
          Reset
        </button>
        <button className="ctrl-btn" onClick={onMenu} data-tut="topbar-menu">
          Menu
        </button>
      </div>
    </header>
  );
}
