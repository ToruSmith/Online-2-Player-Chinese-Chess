import { ADVISOR, CANNON, CHARIOT, ELEPHANT, GENERAL, HORSE, SOLDIER, SQUARES } from '../constants';

/**
 * 子力位置表，同時包含子力價值。表格以紅方視角書寫（第一列是黑方底線），
 * 黑方的數值由翻轉棋盤取得。
 */
// prettier-ignore
const GENERAL_TABLE = [
  ...new Array<number>(63).fill(0),
  0, 0, 0, 1, 1, 1, 0, 0, 0,
  0, 0, 0, 2, 2, 2, 0, 0, 0,
  0, 0, 0, 11, 15, 11, 0, 0, 0,
];
// prettier-ignore
const ADVISOR_TABLE = [
  ...new Array<number>(63).fill(20),
  20, 20, 20, 20, 20, 20, 20, 20, 20,
  20, 20, 20, 20, 23, 20, 20, 20, 20,
  20, 20, 20, 20, 20, 20, 20, 20, 20,
];
// prettier-ignore
const ELEPHANT_TABLE = [
  ...new Array<number>(63).fill(20),
  18, 20, 20, 20, 23, 20, 20, 20, 18,
  20, 20, 20, 20, 20, 20, 20, 20, 20,
  20, 20, 20, 20, 20, 20, 20, 20, 20,
];
// prettier-ignore
const HORSE_TABLE = [
  90, 90, 90, 96, 90, 96, 90, 90, 90,
  90, 96, 103, 97, 94, 97, 103, 96, 90,
  92, 98, 99, 103, 99, 103, 99, 98, 92,
  93, 108, 100, 107, 100, 107, 100, 108, 93,
  90, 100, 99, 103, 104, 103, 99, 100, 90,
  90, 98, 101, 102, 103, 102, 101, 98, 90,
  92, 94, 98, 95, 98, 95, 98, 94, 92,
  93, 92, 94, 95, 92, 95, 94, 92, 93,
  85, 90, 92, 93, 78, 93, 92, 90, 85,
  88, 85, 90, 88, 90, 88, 90, 85, 88,
];
// prettier-ignore
const CHARIOT_TABLE = [
  206, 208, 207, 213, 214, 213, 207, 208, 206,
  206, 212, 209, 216, 233, 216, 209, 212, 206,
  206, 208, 207, 214, 216, 214, 207, 208, 206,
  206, 213, 213, 216, 216, 216, 213, 213, 206,
  208, 211, 211, 214, 215, 214, 211, 211, 208,
  208, 212, 212, 214, 215, 214, 212, 212, 208,
  204, 209, 204, 212, 214, 212, 204, 209, 204,
  198, 208, 204, 212, 212, 212, 204, 208, 198,
  200, 208, 206, 212, 200, 212, 206, 208, 200,
  194, 206, 204, 212, 200, 212, 204, 206, 194,
];
// prettier-ignore
const CANNON_TABLE = [
  100, 100, 96, 91, 90, 91, 96, 100, 100,
  98, 98, 96, 92, 89, 92, 96, 98, 98,
  97, 97, 96, 91, 92, 91, 96, 97, 97,
  96, 99, 99, 98, 100, 98, 99, 99, 96,
  96, 96, 96, 96, 100, 96, 96, 96, 96,
  95, 96, 99, 96, 100, 96, 99, 96, 95,
  96, 96, 96, 96, 96, 96, 96, 96, 96,
  97, 96, 100, 99, 101, 99, 100, 96, 97,
  96, 97, 98, 98, 98, 98, 98, 97, 96,
  96, 96, 97, 99, 99, 99, 97, 96, 96,
];
// prettier-ignore
const SOLDIER_TABLE = [
  9, 9, 9, 11, 13, 11, 9, 9, 9,
  19, 24, 34, 42, 44, 42, 34, 24, 19,
  19, 24, 32, 37, 37, 37, 32, 24, 19,
  19, 23, 27, 29, 30, 29, 27, 23, 19,
  14, 18, 20, 27, 29, 27, 20, 18, 14,
  7, 0, 13, 0, 16, 0, 13, 0, 7,
  7, 0, 7, 0, 15, 0, 7, 0, 7,
  ...new Array<number>(27).fill(0),
];

const TABLES: Record<number, number[]> = {
  [GENERAL]: GENERAL_TABLE,
  [ADVISOR]: ADVISOR_TABLE,
  [ELEPHANT]: ELEPHANT_TABLE,
  [HORSE]: HORSE_TABLE,
  [CHARIOT]: CHARIOT_TABLE,
  [CANNON]: CANNON_TABLE,
  [SOLDIER]: SOLDIER_TABLE,
};

/** 大略的子力價值，用於排序吃子走法。 */
export const MATERIAL = [0, 0, 20, 20, 95, 210, 98, 20];

/** `PIECE_SQUARE[(piece + 7) * 90 + square]`：以紅方為正的評分。 */
export const PIECE_SQUARE = (() => {
  const table = new Int16Array(15 * SQUARES);
  for (let kind = GENERAL; kind <= SOLDIER; kind += 1) {
    for (let square = 0; square < SQUARES; square += 1) {
      const value = TABLES[kind]![square]!;
      table[(kind + 7) * SQUARES + square] = value;
      table[(-kind + 7) * SQUARES + (SQUARES - 1 - square)] = -value;
    }
  }
  return table;
})();

export function evaluateBoard(board: Int8Array): number {
  let score = 0;
  for (let square = 0; square < SQUARES; square += 1) {
    const piece = board[square]!;
    if (piece !== 0) score += PIECE_SQUARE[(piece + 7) * SQUARES + square]!;
  }
  return score;
}
