import { useEffect, useRef } from 'react';
import type { PlayedMove } from '../../engine';

interface MoveLogProps {
  moves: readonly PlayedMove[];
  /** 紅方是否先走。讓子或殘局可能由黑方先手。 */
  blackFirst?: boolean;
  current?: number;
  onSelect?: (ply: number) => void;
}

/** 棋譜紙：每一列是一個回合，左紅右黑。 */
export function MoveLog({ moves, blackFirst = false, current, onSelect }: MoveLogProps) {
  const end = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = end.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [moves.length]);

  if (moves.length === 0) {
    return <p className="log__empty">棋譜會記在這裡</p>;
  }

  const rows: { number: number; cells: { move: PlayedMove; ply: number }[] }[] = [];
  moves.forEach((move, index) => {
    const offset = index + (blackFirst ? 1 : 0);
    const rowIndex = Math.floor(offset / 2);
    rows[rowIndex] ??= { number: rowIndex + 1, cells: [] };
    rows[rowIndex]!.cells.push({ move, ply: index + 1 });
  });

  return (
    <ol ref={end} className="log">
      {rows.map(({ number, cells }, rowIndex) => (
        <li key={number} className="log__row">
          <span className="log__number">{number}</span>
          {blackFirst && rowIndex === 0 && <span className="log__move" />}
          {cells.map(({ move, ply }) =>
            onSelect ? (
              <button
                key={ply}
                type="button"
                className="log__move"
                aria-current={ply === current ? 'true' : undefined}
                onClick={() => onSelect(ply)}
              >
                {move.notation}
              </button>
            ) : (
              <span key={ply} className="log__move">
                {move.notation}
              </span>
            ),
          )}
        </li>
      ))}
    </ol>
  );
}
