import {
  ADVISOR,
  BLACK,
  CANNON,
  CHARIOT,
  ELEPHANT,
  FILES,
  GENERAL,
  HORSE,
  RANKS,
  RED,
  SOLDIER,
  SQUARES,
  type Side,
  isOnBoard,
  toSquare,
} from './constants';

/**
 * 走法生成。為了讓 AI 夠快，這裡使用預先算好的查表，走法也編碼成整數。
 * 一般呼叫者用 `legalMoves()` 與 `moveFrom()` / `moveTo()` 即可。
 */

export const encodeMove = (from: number, to: number): number => from | (to << 8);
export const moveFrom = (move: number): number => move & 0xff;
export const moveTo = (move: number): number => move >> 8;

const sideIndex = (side: Side): 0 | 1 => (side === RED ? 0 : 1);

const inPalace = (x: number, y: number, side: Side): boolean =>
  x >= 3 && x <= 5 && (side === RED ? y >= 7 && y <= 9 : y >= 0 && y <= 2);
const onOwnHalf = (y: number, side: Side): boolean => (side === RED ? y >= 5 : y <= 4);

type Step = readonly [to: number, block: number];

const ORTHOGONAL = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;
const DIAGONAL = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;
const HORSE_JUMPS = [
  [-1, -2],
  [1, -2],
  [-1, 2],
  [1, 2],
  [-2, -1],
  [-2, 1],
  [2, -1],
  [2, 1],
] as const;

function forEachSquare(visit: (x: number, y: number, square: number) => void): void {
  for (let y = 0; y < RANKS; y += 1) {
    for (let x = 0; x < FILES; x += 1) visit(x, y, toSquare(x, y));
  }
}

function perSquare<T>(build: (x: number, y: number) => T): T[] {
  const table = new Array<T>(SQUARES);
  forEachSquare((x, y, square) => {
    table[square] = build(x, y);
  });
  return table;
}

function palaceSteps(deltas: readonly (readonly [number, number])[], side: Side): number[][] {
  return perSquare((x, y) => {
    if (!inPalace(x, y, side)) return [];
    return deltas
      .filter(([dx, dy]) => inPalace(x + dx, y + dy, side))
      .map(([dx, dy]) => toSquare(x + dx, y + dy));
  });
}

const GENERAL_STEPS = [palaceSteps(ORTHOGONAL, RED), palaceSteps(ORTHOGONAL, BLACK)];
const ADVISOR_STEPS = [palaceSteps(DIAGONAL, RED), palaceSteps(DIAGONAL, BLACK)];

const buildElephantSteps = (side: Side): Step[][] =>
  perSquare((x, y) =>
    DIAGONAL.filter(([dx, dy]) => {
      const toX = x + dx * 2;
      const toY = y + dy * 2;
      return isOnBoard(toX, toY) && onOwnHalf(toY, side);
    }).map(([dx, dy]): Step => [toSquare(x + dx * 2, y + dy * 2), toSquare(x + dx, y + dy)]),
  );
const ELEPHANT_STEPS = [buildElephantSteps(RED), buildElephantSteps(BLACK)];

/** 馬腳緊鄰馬本身，位於「長邊」方向上。 */
const horseLeg = (x: number, y: number, dx: number, dy: number): number =>
  Math.abs(dy) === 2 ? toSquare(x, y + dy / 2) : toSquare(x + dx / 2, y);

const HORSE_STEPS: Step[][] = perSquare((x, y) =>
  HORSE_JUMPS.filter(([dx, dy]) => isOnBoard(x + dx, y + dy)).map(
    ([dx, dy]): Step => [toSquare(x + dx, y + dy), horseLeg(x, y, dx, dy)],
  ),
);

/** 反查：哪些位置的馬能跳到這一格，以及該馬對應的馬腳。 */
const HORSE_ATTACKERS: Step[][] = perSquare((x, y) =>
  HORSE_JUMPS.filter(([dx, dy]) => isOnBoard(x + dx, y + dy)).map(([dx, dy]): Step => {
    const horseX = x + dx;
    const horseY = y + dy;
    return [toSquare(horseX, horseY), horseLeg(horseX, horseY, -dx, -dy)];
  }),
);

const buildSoldierSteps = (side: Side): number[][] =>
  perSquare((x, y) => {
    const forward = side === RED ? -1 : 1;
    const steps: number[] = [];
    if (isOnBoard(x, y + forward)) steps.push(toSquare(x, y + forward));
    if (!onOwnHalf(y, side)) {
      if (x > 0) steps.push(toSquare(x - 1, y));
      if (x < FILES - 1) steps.push(toSquare(x + 1, y));
    }
    return steps;
  });
const SOLDIER_STEPS = [buildSoldierSteps(RED), buildSoldierSteps(BLACK)];

/** 每一格往四個方向延伸的格子序列。 */
const RAYS: number[][][] = perSquare((x, y) =>
  ORTHOGONAL.map(([dx, dy]) => {
    const ray: number[] = [];
    for (let cx = x + dx, cy = y + dy; isOnBoard(cx, cy); cx += dx, cy += dy) {
      ray.push(toSquare(cx, cy));
    }
    return ray;
  }),
);

const PALACE_SQUARES: number[][] = [RED, BLACK].map((side) => {
  const squares: number[] = [];
  forEachSquare((x, y, square) => {
    if (inPalace(x, y, side as Side)) squares.push(square);
  });
  return squares;
});

const isOwn = (piece: number, side: Side): boolean => (side === RED ? piece > 0 : piece < 0);

/** 產生不考慮「走後被將」的走法，寫入 `out` 以減少配置。 */
export function generatePseudoMoves(
  board: Int8Array,
  side: Side,
  out: number[],
  capturesOnly = false,
): void {
  const index = sideIndex(side);

  const addStep = (from: number, to: number): void => {
    const target = board[to]!;
    if (isOwn(target, side) || (capturesOnly && target === 0)) return;
    out.push(encodeMove(from, to));
  };

  for (let from = 0; from < SQUARES; from += 1) {
    const piece = board[from]!;
    if (piece === 0 || !isOwn(piece, side)) continue;

    switch (Math.abs(piece)) {
      case GENERAL:
        for (const to of GENERAL_STEPS[index]![from]!) addStep(from, to);
        break;
      case ADVISOR:
        for (const to of ADVISOR_STEPS[index]![from]!) addStep(from, to);
        break;
      case ELEPHANT:
        for (const [to, eye] of ELEPHANT_STEPS[index]![from]!) {
          if (board[eye] === 0) addStep(from, to);
        }
        break;
      case HORSE:
        for (const [to, leg] of HORSE_STEPS[from]!) {
          if (board[leg] === 0) addStep(from, to);
        }
        break;
      case CHARIOT:
        for (const ray of RAYS[from]!) {
          for (const to of ray) {
            const target = board[to]!;
            if (target === 0) {
              if (!capturesOnly) out.push(encodeMove(from, to));
              continue;
            }
            if (!isOwn(target, side)) out.push(encodeMove(from, to));
            break;
          }
        }
        break;
      case CANNON:
        for (const ray of RAYS[from]!) {
          let screened = false;
          for (const to of ray) {
            const target = board[to]!;
            if (!screened) {
              if (target !== 0) screened = true;
              else if (!capturesOnly) out.push(encodeMove(from, to));
            } else if (target !== 0) {
              if (!isOwn(target, side)) out.push(encodeMove(from, to));
              break;
            }
          }
        }
        break;
      case SOLDIER:
        for (const to of SOLDIER_STEPS[index]![from]!) addStep(from, to);
        break;
    }
  }
}

export function findGeneral(board: Int8Array, side: Side): number {
  for (const square of PALACE_SQUARES[sideIndex(side)]!) {
    if (board[square] === side * GENERAL) return square;
  }
  return -1;
}

/**
 * 判斷某方是否被將軍。兩將照面也算在內，
 * 因此「不能走成王見王」會自然成為合法性檢查的一部分。
 */
export function isInCheck(board: Int8Array, side: Side): boolean {
  const general = findGeneral(board, side);
  if (general < 0) return true;
  const enemy = -side;

  for (const ray of RAYS[general]!) {
    let seen = 0;
    for (const square of ray) {
      const piece = board[square]!;
      if (piece === 0) continue;
      seen += 1;
      if (seen === 1) {
        if (piece === enemy * CHARIOT || piece === enemy * GENERAL) return true;
      } else {
        if (piece === enemy * CANNON) return true;
        break;
      }
    }
  }

  for (const [square, leg] of HORSE_ATTACKERS[general]!) {
    if (board[square] === enemy * HORSE && board[leg] === 0) return true;
  }

  // 敵方的兵朝我方前進；能貼近將帥的兵必定已過河，所以左右也算攻擊。
  const soldier = enemy * SOLDIER;
  const behind = general + (side === RED ? -FILES : FILES);
  if (behind >= 0 && behind < SQUARES && board[behind] === soldier) return true;
  if (general % FILES > 0 && board[general - 1] === soldier) return true;
  if (general % FILES < FILES - 1 && board[general + 1] === soldier) return true;

  return false;
}

function isLegal(board: Int8Array, side: Side, move: number): boolean {
  const from = moveFrom(move);
  const to = moveTo(move);
  const moved = board[from]!;
  const captured = board[to]!;
  board[to] = moved;
  board[from] = 0;
  const legal = !isInCheck(board, side);
  board[from] = moved;
  board[to] = captured;
  return legal;
}

/** 該方所有合法走法。 */
export function legalMoves(board: Int8Array, side: Side): number[] {
  const pseudo: number[] = [];
  generatePseudoMoves(board, side, pseudo);
  return pseudo.filter((move) => isLegal(board, side, move));
}

/** 指定格子上棋子的合法落點。 */
export function legalTargets(board: Int8Array, from: number): number[] {
  const piece = board[from]!;
  if (piece === 0) return [];
  const side: Side = piece > 0 ? RED : BLACK;
  return legalMoves(board, side)
    .filter((move) => moveFrom(move) === from)
    .map(moveTo);
}

export function hasLegalMove(board: Int8Array, side: Side): boolean {
  const pseudo: number[] = [];
  generatePseudoMoves(board, side, pseudo);
  return pseudo.some((move) => isLegal(board, side, move));
}
