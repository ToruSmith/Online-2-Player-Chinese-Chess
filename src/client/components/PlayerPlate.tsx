import { useEffect, useState } from 'react';
import type { Color } from '../../engine';
import { formatClock } from '../lib/copy';
import { PieceFace } from './Piece';

interface PlayerPlateProps {
  name: string;
  color: Color;
  active: boolean;
  captured: readonly number[];
  status?: string;
  clock?: { remaining: number; running: boolean } | null;
  bubble?: string | null;
}

function Clock({ remaining, running }: { remaining: number; running: boolean }) {
  const [shown, setShown] = useState(remaining);

  useEffect(() => {
    setShown(remaining);
    if (!running) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setShown(Math.max(0, remaining - (Date.now() - startedAt)));
    }, 200);
    return () => window.clearInterval(timer);
  }, [remaining, running]);

  const urgent = shown < 30_000;
  return (
    <span className={`clock${urgent ? ' clock--urgent' : ''}`} role="timer">
      {formatClock(shown)}
    </span>
  );
}

export function PlayerPlate({
  name,
  color,
  active,
  captured,
  status,
  clock,
  bubble,
}: PlayerPlateProps) {
  return (
    <section className={`plate plate--${color}${active ? ' plate--active' : ''}`}>
      <span className="plate__badge" aria-hidden="true" />
      <div className="plate__who">
        <strong className="plate__name">{name}</strong>
        {status && <span className="plate__status">{status}</span>}
      </div>
      <div className="plate__captured" aria-label={`吃掉 ${captured.length} 子`}>
        {captured.map((piece, index) => (
          <span key={`${piece}-${index}`} className="plate__capture">
            <PieceFace piece={piece} />
          </span>
        ))}
      </div>
      {clock && <Clock remaining={clock.remaining} running={clock.running} />}
      {bubble && (
        <span key={bubble} className="plate__bubble" role="status">
          {bubble}
        </span>
      )}
    </section>
  );
}
