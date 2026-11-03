import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Color,
  FILES,
  GENERAL,
  type PlayedMove,
  RANKS,
  SQUARES,
  fileOf,
  findGeneral,
  legalTargets,
  pieceGlyph,
  rankOf,
  sideOf,
  toSquare,
} from '../../engine';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import type { TrackedPiece } from '../lib/pieces';
import { BoardLines } from './BoardLines';
import { PieceFace } from './Piece';

export interface BoardProps {
  board: Int8Array;
  pieces: TrackedPiece[];
  turn: Color;
  /** 目前能操作的顏色；null 表示只能看。 */
  movable: Color | 'both' | null;
  flipped?: boolean;
  /** 同機對坐時，黑方的字轉向對面。 */
  facing?: boolean;
  lastMove?: PlayedMove;
  inCheck?: boolean;
  hint?: { from: number; to: number } | null;
  onMove?: (from: number, to: number) => void;
  label?: string;
}

const squareName = (board: Int8Array, square: number): string => {
  const piece = board[square]!;
  const place = `第 ${rankOf(square) + 1} 列第 ${fileOf(square) + 1} 行`;
  if (piece === 0) return `${place}，空位`;
  return `${place}，${piece > 0 ? '紅' : '黑'}${pieceGlyph(piece)}`;
};

export function Board({
  board,
  pieces,
  turn,
  movable,
  flipped = false,
  facing = false,
  lastMove,
  inCheck = false,
  hint = null,
  onMove,
  label = '棋盤',
}: BoardProps) {
  const { showMoves } = useSettings();
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState(toSquare(4, 7));
  const grid = useRef<HTMLDivElement>(null);

  const canAct = movable === 'both' || movable === turn;
  const targets = useMemo(
    () => (selected !== null && canAct ? legalTargets(board, selected) : []),
    [board, selected, canAct],
  );

  // 棋子位置變了才取消選取；有人進出房間這類更新不該打斷玩家。
  const boardKey = board.join();
  useEffect(() => setSelected(null), [boardKey]);

  const place = (square: number) => {
    const x = fileOf(square);
    const y = rankOf(square);
    return flipped ? { col: FILES - 1 - x, row: RANKS - 1 - y } : { col: x, row: y };
  };
  const position = (square: number) => {
    const { col, row } = place(square);
    return { transform: `translate(${col * 100}%, ${row * 100}%)` };
  };

  const ownsPiece = (square: number) => {
    const piece = board[square]!;
    return piece !== 0 && Math.sign(piece) === sideOf(turn);
  };

  const activate = (square: number) => {
    if (!canAct) return;
    if (selected !== null && targets.includes(square)) {
      setSelected(null);
      onMove?.(selected, square);
      return;
    }
    if (ownsPiece(square) && square !== selected) {
      setSelected(square);
      playSound('select');
      return;
    }
    setSelected(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = {
      ArrowUp: [0, flipped ? 1 : -1],
      ArrowDown: [0, flipped ? -1 : 1],
      ArrowLeft: [flipped ? 1 : -1, 0],
      ArrowRight: [flipped ? -1 : 1, 0],
    }[event.key];
    if (step) {
      event.preventDefault();
      const x = Math.min(FILES - 1, Math.max(0, fileOf(cursor) + step[0]!));
      const y = Math.min(RANKS - 1, Math.max(0, rankOf(cursor) + step[1]!));
      setCursor(toSquare(x, y));
      grid.current?.querySelector<HTMLElement>(`[data-square="${toSquare(x, y)}"]`)?.focus();
    }
    if (event.key === 'Escape') setSelected(null);
  };

  const checkedGeneral = inCheck ? findGeneral(board, sideOf(turn)) : -1;
  const capture =
    lastMove && lastMove.captured !== 0 ? { piece: lastMove.captured, square: lastMove.to } : null;

  return (
    <div className="board" role="group" aria-label={label}>
      <BoardLines />

      {lastMove && (
        <>
          <span className="mark mark--from" style={position(lastMove.from)} />
          <span className="mark mark--to" style={position(lastMove.to)} />
        </>
      )}
      {capture && (
        <span key={lastMove?.to} className="piece piece--captured" style={position(capture.square)}>
          <PieceFace piece={capture.piece} />
        </span>
      )}

      {pieces.map(({ id, piece, square }) => (
        <span
          key={id}
          className={[
            'piece',
            square === selected ? 'piece--selected' : '',
            square === checkedGeneral ? 'piece--checked' : '',
            Math.abs(piece) === GENERAL ? 'piece--general' : '',
          ].join(' ')}
          style={position(square)}
        >
          <PieceFace piece={piece} upsideDown={facing && piece < 0} />
        </span>
      ))}

      {showMoves &&
        targets.map((square) => (
          <span
            key={square}
            className={board[square] ? 'mark mark--capture' : 'mark mark--target'}
            style={position(square)}
          />
        ))}

      {hint && <HintArrow from={place(hint.from)} to={place(hint.to)} />}

      <div ref={grid} className="board__grid" onKeyDown={onKeyDown}>
        {Array.from({ length: SQUARES }, (_, viewIndex) => {
          const square = flipped ? SQUARES - 1 - viewIndex : viewIndex;
          return (
            <button
              key={square}
              type="button"
              data-square={square}
              className="board__cell"
              tabIndex={square === cursor ? 0 : -1}
              aria-label={squareName(board, square)}
              aria-pressed={square === selected}
              onFocus={() => setCursor(square)}
              onClick={() => activate(square)}
            />
          );
        })}
      </div>
    </div>
  );
}

function HintArrow({
  from,
  to,
}: {
  from: { col: number; row: number };
  to: { col: number; row: number };
}) {
  const x1 = from.col * 100 + 50;
  const y1 = from.row * 100 + 50;
  const x2 = to.col * 100 + 50;
  const y2 = to.row * 100 + 50;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const tipX = x2 - Math.cos(angle) * 18;
  const tipY = y2 - Math.sin(angle) * 18;
  return (
    <svg className="board__hint" viewBox="0 0 900 1000" aria-hidden="true">
      <defs>
        <marker id="hint-head" markerWidth="4" markerHeight="4" refX="2.4" refY="2" orient="auto">
          <path d="M0 0L4 2L0 4z" fill="currentColor" />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={tipX} y2={tipY} markerEnd="url(#hint-head)" />
    </svg>
  );
}
