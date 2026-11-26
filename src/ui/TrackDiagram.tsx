import { memo, useMemo } from 'react';
import type { Aspect, MapDefinition, SimSnapshot } from '../engine/types';

const Y_OFFSET = 26;
const TRAIN_LEN_UNITS = 4.6;

interface Props {
  map: MapDefinition;
  snap: SimSnapshot;
  trainGeom: Map<number, { x: number; y: number; angle: number }>;
  onSelect: (kind: 'signal' | 'point' | 'train' | null, id: string | null) => void;
  showLabels?: boolean;
}

const ASPECT_COLORS: Record<Aspect, string> = {
  red: '#ff3b30',
  yellow: '#ffd60a',
  'double-yellow': '#ff9f0a',
  green: '#30d158',
};

function SignalHead({ x, y, aspect, selected }: { x: number; y: number; aspect: Aspect; selected: boolean }) {
  const lamps: { cy: number; color: string | null }[] =
    aspect === 'double-yellow'
      ? [
          { cy: -3.4, color: '#ffd60a' },
          { cy: 3.4, color: '#ffd60a' },
        ]
      : [{ cy: 0, color: ASPECT_COLORS[aspect] }];
  return (
    <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }}>
      {selected && <circle r={7.5} fill="none" stroke="#0a84ff" strokeWidth={1.4} />}
      <rect x={-3.4} y={-6.4} width={6.8} height={12.8} rx={2} fill="#10151c" stroke="#3a4756" strokeWidth={0.7} />
      {lamps.map((l, i) =>
        l.color ? (
          <circle key={i} cx={0} cy={l.cy} r={2.1} fill={l.color} />
        ) : null,
      )}
      {aspect === 'red' && <circle cx={0} cy={0} r={2.1} fill={ASPECT_COLORS.red} />}
    </g>
  );
}

export const TrackDiagram = memo(function TrackDiagram({ map, snap, trainGeom, onSelect, showLabels = true }: Props) {
  const nodeById = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map]);

  const sectionGeom = useMemo(() => {
    return map.sections.map((s) => {
      const a = nodeById.get(s.from)!;
      const b = nodeById.get(s.to)!;
      return { sec: s, x1: a.x, y1: a.y + Y_OFFSET, x2: b.x, y2: b.y + Y_OFFSET };
    });
  }, [map, nodeById]);

  return (
    <svg
      viewBox={`0 0 ${map.width} ${map.height + Y_OFFSET + 14}`}
      className="track-diagram"
      preserveAspectRatio="xMidYMid meet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null, null);
      }}
      data-tut="diagram"
    >
      <rect x={0} y={0} width={map.width} height={map.height + Y_OFFSET + 14} fill="transparent" />
      {map.boundaries.map((b) => (
        <g key={b.id}>
          <line x1={b.x} y1={10} x2={b.x} y2={map.height + Y_OFFSET - 6} stroke="#2c3a4a" strokeWidth={1} strokeDasharray="4 4" />
          <text x={b.x + (b.side === 'west' ? -4 : 4)} y={map.height + Y_OFFSET + 8} textAnchor={b.side === 'west' ? 'end' : 'start'} className="boundary-label">
            {b.name}
          </text>
        </g>
      ))}

      {map.stations.map((st) => {
        const nodes = map.nodes.filter((n) => n.stationId === st.id);
        const xs = nodes.map((n) => n.x);
        const minX = Math.min(...xs) - 3;
        const maxX = Math.max(...xs) + 3;
        return (
          <g key={st.id} data-tut={`station-${st.id}`}>
            <rect x={minX} y={4} width={maxX - minX} height={map.height + Y_OFFSET - 8} fill="none" stroke="#22303f" strokeWidth={0.8} strokeDasharray="2 3" />
            <text x={st.x} y={Y_OFFSET - 12} textAnchor="middle" className="station-label">
              {st.name}
            </text>
          </g>
        );
      })}

      {map.lines.map((line) => (
        <g key={line.id} data-tut={`line-${line.id}`}>
          <text x={map.width - 6} y={line.y + Y_OFFSET - 8} textAnchor="end" className="line-label" fill={line.direction === 'up' ? '#7fb3d5' : '#d5a0a0'}>
            {line.name}
          </text>
          <text x={30} y={line.y + Y_OFFSET + 2} textAnchor="middle" className="direction-arrow" fill={line.direction === 'up' ? '#4a6a85' : '#85524a'}>
            {line.direction === 'up' ? '›' : '‹'}
          </text>
        </g>
      ))}

      {sectionGeom.map(({ sec, x1, y1, x2, y2 }) => {
        const occupied = (snap.occupied[sec.id] ?? 0) > 0;
        const isPlatform = sec.kind === 'platform';
        const isDiag = sec.kind === 'diagonal';
        return (
          <line
            key={sec.id}
            data-tut={`section-${sec.id}`}
            data-occupied={occupied || undefined}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={occupied ? '#e5484d' : isDiag ? '#54687e' : isPlatform ? '#46586c' : '#33465c'}
            strokeWidth={occupied ? 5 : isPlatform ? 4.5 : isDiag ? 2.4 : 3}
            strokeLinecap="butt"
          />
        );
      })}

      {map.points.map((p) => {
        const pos = snap.pointPositions[p.id] ?? 'normal';
        const selected = snap.selected.kind === 'point' && snap.selected.id === p.id;
        const node = nodeById.get(p.node);
        if (!node) return null;
        const y = node.y + Y_OFFSET;
        const rev = pos === 'reverse';
        return (
          <g key={p.id} data-tut={`point-${p.id}`} transform={`translate(${p.x},${y})`} style={{ cursor: 'pointer' }} onClick={() => onSelect('point', p.id)}>
            {selected && <circle r={8} fill="none" stroke="#0a84ff" strokeWidth={1.4} />}
            <rect x={-5} y={-3.2} width={10} height={6.4} rx={1.2} fill={rev ? '#3a2b12' : '#14202c'} stroke={rev ? '#c98f2d' : '#4a5f75'} strokeWidth={0.8} />
            <line x1={-5} y1={0} x2={rev ? 5 : -5} y2={rev ? -3.2 : 0} stroke={rev ? '#e8b04b' : '#5d748c'} strokeWidth={1.4} />
            <text y={-7} textAnchor="middle" className="point-label">
              {rev ? 'R' : 'N'}
            </text>
          </g>
        );
      })}

      {map.signals.map((sig) => {
        const aspect = snap.aspects[sig.id] ?? 'red';
        const selected = snap.selected.kind === 'signal' && snap.selected.id === sig.id;
        const y = sig.y + Y_OFFSET + (sig.side === -1 ? -15 : 15);
        const activeRoute = snap.routes.find((r) => r.signalId === sig.id);
        return (
          <g key={sig.id} data-tut={`signal-${sig.id}`} onClick={() => onSelect('signal', sig.id)} style={{ cursor: 'pointer' }}>
            <SignalHead x={sig.x} y={y} aspect={aspect} selected={selected} />
            {activeRoute && <circle cx={sig.x} cy={y + (sig.side === -1 ? 9 : -9)} r={1.8} fill="#0a84ff" />}
            {showLabels && (
              <text x={sig.x} y={y + (sig.side === -1 ? 13 : -11)} textAnchor="middle" className="signal-label">
                {sig.label}
              </text>
            )}
          </g>
        );
      })}

      {[...trainGeom.entries()].map(([uid, g]) => {
        const ts = snap.trains.find((t) => t.uid === uid);
        if (!ts || ts.state === 'completed' || ts.state === 'scheduled') return null;
        const selected = snap.selected.kind === 'train' && snap.selected.id === String(uid);
        const w = TRAIN_LEN_UNITS;
        const h = 7;
        return (
          <g key={uid} data-tut={`train-${ts.headcode}`} transform={`translate(${g.x},${g.y}) rotate(${g.angle})`} onClick={() => onSelect('train', String(uid))} style={{ cursor: 'pointer' }}>
            {selected && <rect x={-w / 2 - 2} y={-h / 2 - 2} width={w + 4} height={h + 4} rx={2} fill="none" stroke="#0a84ff" strokeWidth={1.4} />}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={1.6} fill={ts.late ? '#5a2b2b' : '#1d2b3a'} stroke={ts.late ? '#e5484d' : '#6d84a0'} strokeWidth={0.8} />
            <text x={0} y={1.6} textAnchor="middle" className="train-label">
              {ts.headcode}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
