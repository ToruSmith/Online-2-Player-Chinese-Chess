import {
  CANNON,
  CHARIOT,
  HORSE,
  INITIAL_FEN,
  SOLDIER,
  type Color,
  colorOf,
  opposite,
  sideOf,
} from './constants';
import { isChasingMove } from './chase';
import { parseFen, toFen } from './fen';
import { encodeMove, hasLegalMove, isInCheck, legalMoves } from './moves';
import { moveNotation } from './notation';

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'perpetual-check'
  | 'perpetual-chase'
  | 'repetition'
  | 'no-capture'
  | 'insufficient'
  | 'resign'
  | 'timeout'
  | 'agreement';

export interface Outcome {
  /** 平局時為 null。 */
  winner: Color | null;
  reason: EndReason;
}

export interface PlayedMove {
  from: number;
  to: number;
  piece: number;
  captured: number;
  /** 這步棋是否形成將軍。 */
  check: boolean;
  notation: string;
}

/** 一盤棋的完整狀態。所有更新函式都回傳新物件，可直接放進 React state。 */
export interface Game {
  initialFen: string;
  board: Int8Array;
  turn: Color;
  moves: PlayedMove[];
  /** 每個局面的識別字串，第 n 項是走完 n 步後的局面。 */
  positions: string[];
  /** 連續未吃子的步數（單方一步算一步）。 */
  quietPlies: number;
  inCheck: boolean;
  outcome: Outcome | null;
}

/** 自然限著：雙方合計 120 步（60 回合）未吃子判和。 */
export const NO_CAPTURE_LIMIT = 120;
const REPETITION_LIMIT = 3;

export function createGame(fen: string = INITIAL_FEN): Game {
  const { board, turn } = parseFen(fen);
  const game: Game = {
    initialFen: toFen(board, turn),
    board,
    turn,
    moves: [],
    positions: [toFen(board, turn)],
    quietPlies: 0,
    inCheck: isInCheck(board, sideOf(turn)),
    outcome: null,
  };
  return { ...game, outcome: detectOutcome(game) };
}

/** 走一步棋；不合法時回傳 null。 */
export function playMove(game: Game, from: number, to: number): Game | null {
  if (game.outcome) return null;
  const side = sideOf(game.turn);
  if (!legalMoves(game.board, side).includes(encodeMove(from, to))) return null;

  const notation = moveNotation(game.board, from, to);
  const board = game.board.slice();
  const piece = board[from]!;
  const captured = board[to]!;
  board[to] = piece;
  board[from] = 0;

  const turn = opposite(game.turn);
  const inCheck = isInCheck(board, sideOf(turn));
  const next: Game = {
    ...game,
    board,
    turn,
    moves: [...game.moves, { from, to, piece, captured, check: inCheck, notation }],
    positions: [...game.positions, toFen(board, turn)],
    quietPlies: captured ? 0 : game.quietPlies + 1,
    inCheck,
    outcome: null,
  };
  return { ...next, outcome: detectOutcome(next) };
}

/** 由起始局面重播一串走法；任何一步不合法都會丟出錯誤。 */
export function replay(initialFen: string, moves: readonly (readonly [number, number])[]): Game {
  let game = createGame(initialFen);
  for (const [from, to] of moves) {
    const next = playMove(game, from, to);
    if (!next) throw new Error(`棋譜含有不合法的走法：${from} → ${to}`);
    game = next;
  }
  return game;
}

/** 收回最後 `plies` 步，並清除終局狀態。 */
export function takeBack(game: Game, plies: number): Game {
  const kept = game.moves.slice(0, Math.max(0, game.moves.length - plies));
  return replay(
    game.initialFen,
    kept.map((move) => [move.from, move.to] as const),
  );
}

/** 以棋盤以外的原因結束對局，例如認輸、超時或議和。 */
export const endGame = (game: Game, outcome: Outcome): Game =>
  game.outcome ? game : { ...game, outcome };

function detectOutcome(game: Game): Outcome | null {
  // 中國象棋沒有逼和：無子可走的一方直接判負，被將軍叫絕殺、沒被將軍叫困斃。
  if (!hasLegalMove(game.board, sideOf(game.turn))) {
    return {
      winner: opposite(game.turn),
      reason: game.inCheck ? 'checkmate' : 'stalemate',
    };
  }
  return (
    detectRepetition(game) ??
    (game.quietPlies >= NO_CAPTURE_LIMIT ? { winner: null, reason: 'no-capture' } : null) ??
    (hasInsufficientMaterial(game.board) ? { winner: null, reason: 'insufficient' } : null)
  );
}

/**
 * 同一局面第三次出現時結束對局。這段循環裡若只有一方每步都在將軍，
 * 該方以「長將」判負；若只有一方每步都在將軍或捉子，且至少捉了一次，
 * 該方以「長捉」判負；其他情況判和。
 */
function detectRepetition(game: Game): Outcome | null {
  const current = game.positions[game.positions.length - 1];
  const occurrences: number[] = [];
  game.positions.forEach((position, index) => {
    if (position === current) occurrences.push(index);
  });
  if (occurrences.length < REPETITION_LIMIT) return null;

  const start = occurrences[occurrences.length - REPETITION_LIMIT]!;
  const cycle = game.moves.slice(start);
  const alwaysChecks = (color: Color): boolean => {
    const own = cycle.filter((move) => colorOf(move.piece > 0 ? 1 : -1) === color);
    return own.length > 0 && own.every((move) => move.check);
  };
  const red = alwaysChecks('red');
  const black = alwaysChecks('black');
  if (red !== black) return { winner: red ? 'black' : 'red', reason: 'perpetual-check' };

  const redChases = alwaysForces(game, start, 'red');
  const blackChases = alwaysForces(game, start, 'black');
  if (redChases !== blackChases) {
    return { winner: redChases ? 'black' : 'red', reason: 'perpetual-chase' };
  }
  return { winner: null, reason: 'repetition' };
}

/** `color` 在循環裡每步都將軍或捉子，而且至少捉了一次。 */
function alwaysForces(game: Game, start: number, color: Color): boolean {
  let chases = 0;
  for (let index = start; index < game.moves.length; index += 1) {
    const move = game.moves[index]!;
    if (colorOf(move.piece > 0 ? 1 : -1) !== color) continue;
    const before = parseFen(game.positions[index]!).board;
    const after = parseFen(game.positions[index + 1]!).board;
    const chasing = isChasingMove(before, after, sideOf(color));
    if (chasing) chases += 1;
    else if (!move.check) return false;
  }
  return chases > 0;
}

/** 雙方都只剩不能過河的棋子時，誰也將不死對方。 */
function hasInsufficientMaterial(board: Int8Array): boolean {
  return !board.some((piece) => {
    const kind = Math.abs(piece);
    return kind === CHARIOT || kind === HORSE || kind === CANNON || kind === SOLDIER;
  });
}

export const legalMovesOf = (game: Game): number[] =>
  game.outcome ? [] : legalMoves(game.board, sideOf(game.turn));

export const lastMove = (game: Game): PlayedMove | undefined => game.moves[game.moves.length - 1];
