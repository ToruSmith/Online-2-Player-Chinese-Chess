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
  type Color,
  fileOf,
  pieceKind,
  pieceSide,
  rankOf,
  toSquare,
} from './constants';

const LETTER_TO_KIND: Record<string, number> = {
  k: GENERAL,
  a: ADVISOR,
  b: ELEPHANT,
  n: HORSE,
  r: CHARIOT,
  c: CANNON,
  p: SOLDIER,
};
const KIND_TO_LETTER = ['', 'k', 'a', 'b', 'n', 'r', 'c', 'p'];

export interface Position {
  board: Int8Array;
  turn: Color;
}

/** 解析 FEN。格式不正確或局面不合法時會丟出錯誤。 */
export function parseFen(fen: string): Position {
  const [placement, turnField = 'w'] = fen.trim().split(/\s+/);
  const rows = placement?.split('/') ?? [];
  if (rows.length !== RANKS) throw new Error(`FEN 應有 ${RANKS} 列：${fen}`);

  const board = new Int8Array(SQUARES);
  rows.forEach((row, y) => {
    let x = 0;
    for (const char of row) {
      if (char >= '1' && char <= '9') {
        x += Number(char);
        continue;
      }
      const kind = LETTER_TO_KIND[char.toLowerCase()];
      if (!kind || x >= FILES) throw new Error(`FEN 含有無效內容：${fen}`);
      board[toSquare(x, y)] = char === char.toUpperCase() ? RED * kind : BLACK * kind;
      x += 1;
    }
    if (x !== FILES) throw new Error(`FEN 第 ${y + 1} 列寬度錯誤：${fen}`);
  });

  if (turnField !== 'w' && turnField !== 'r' && turnField !== 'b') {
    throw new Error(`FEN 的走子方無效：${fen}`);
  }
  assertValidGenerals(board);
  return { board, turn: turnField === 'b' ? 'black' : 'red' };
}

function assertValidGenerals(board: Int8Array): void {
  let red = -1;
  let black = -1;
  board.forEach((piece, square) => {
    if (piece === RED * GENERAL) red = red === -1 ? square : -2;
    if (piece === BLACK * GENERAL) black = black === -1 ? square : -2;
  });
  const inPalace = (square: number, side: number) => {
    const x = fileOf(square);
    const y = rankOf(square);
    return x >= 3 && x <= 5 && (side === RED ? y >= 7 : y <= 2);
  };
  if (red < 0 || black < 0 || !inPalace(red, RED) || !inPalace(black, BLACK)) {
    throw new Error('局面必須各有一個位於九宮內的將帥');
  }
}

/** 只輸出棋子配置與走子方。 */
export function toFen(board: Int8Array, turn: Color): string {
  const rows: string[] = [];
  for (let y = 0; y < RANKS; y += 1) {
    let row = '';
    let empty = 0;
    for (let x = 0; x < FILES; x += 1) {
      const piece = board[toSquare(x, y)]!;
      if (piece === 0) {
        empty += 1;
        continue;
      }
      if (empty) row += String(empty);
      empty = 0;
      const letter = KIND_TO_LETTER[pieceKind(piece)]!;
      row += pieceSide(piece) === RED ? letter.toUpperCase() : letter;
    }
    rows.push(row + (empty ? String(empty) : ''));
  }
  return `${rows.join('/')} ${turn === 'red' ? 'w' : 'b'}`;
}
