import { CANNON, CHARIOT, GENERAL, HORSE, SOLDIER, type Side } from './constants';
import { legalMoves, moveFrom, moveTo } from './moves';

const CHASERS = new Set([CHARIOT, HORSE, CANNON]);

/** `side` 的車馬炮能白吃的棋子：吃掉後對方吃不回來。將帥與兵卒不算被捉。 */
export function chasedSquares(board: Int8Array, side: Side): Set<number> {
  const chased = new Set<number>();
  for (const move of legalMoves(board, side)) {
    const from = moveFrom(move);
    const to = moveTo(move);
    const attacker = board[from]!;
    const target = board[to]!;
    const kind = Math.abs(target);
    if (target === 0 || kind === GENERAL || kind === SOLDIER) continue;
    if (!CHASERS.has(Math.abs(attacker))) continue;

    const after = board.slice();
    after[to] = attacker;
    after[from] = 0;
    const recaptured = legalMoves(after, -side as Side).some((reply) => moveTo(reply) === to);
    if (!recaptured) chased.add(to);
  }
  return chased;
}

/** 這一步是否捉住了走之前沒有被捉的棋子。 */
export function isChasingMove(before: Int8Array, after: Int8Array, side: Side): boolean {
  const earlier = chasedSquares(before, side);
  return [...chasedSquares(after, side)].some((square) => !earlier.has(square));
}
