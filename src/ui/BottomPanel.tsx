import type { LogEntry } from '../engine/types';
import { fmtClock } from './format';

interface Props {
  log: LogEntry[];
}

export function BottomPanel({ log }: Props) {
  return (
    <footer className="bottom-panel">
      <div className="messages-panel" data-tut="messages-panel">
        <div className="panel-title">Operational messages</div>
        <div className="messages-empty">No operational messages</div>
      </div>
      <div className="log-panel" data-tut="log-panel">
        <div className="panel-title">Event log</div>
        <div className="log-list">
          {[...log].reverse().map((e, i) => (
            <div key={i} className={`log-entry log-${e.kind}`}>
              <span className="log-time">{fmtClock(e.t)}</span>
              <span>{e.message}</span>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
