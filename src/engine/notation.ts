import {
  ADVISOR,
  ELEPHANT,
  FILES,
  HORSE,
  RED,
  RANKS,
  SOLDIER,
  type Side,
  fileOf,
  pieceGlyph,
  pieceKind,
  pieceSide,
  rankOf,
  toSquare,
} from './constants';

const CHINESE_NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 紅方用中文數字由右往左數，黑方用阿拉伯數字由自己的右手邊數。 */
const fileLabel = (x: number, side: Side): string =>
  side === RED ? CHINESE_NUMERALS[FILES - x]! : String(x + 1);
const stepLabel = (steps: number, side: Side): string =>
  side === RED ? CHINESE_NUMERALS[steps]! : String(steps);

function tandemPrefix(index: number, total: number): string {
  if (total === 2) return ['前', '後'][index]!;
  if (total === 3) return ['前', '中', '後'][index]!;
  return ['一', '二', '三', '四', '五'][index]!;
}

/** 列出同一路上的同種棋子，排序為最前方（最深入敵陣）優先。 */
function squaresOnFile(board: Int8Array, piece: number, x: number, side: Side): number[] {
  const squares: number[] = [];
  for (let y = 0; y < RANKS; y += 1) {
    const square = toSquare(x, y);
    if (board[square] === piece) squares.push(square);
  }
  return side === RED ? squares : squares.reverse();
}

function hasOtherTandemFile(board: Int8Array, piece: number, x: number, side: Side): boolean {
  for (let other = 0; other < FILES; other += 1) {
    if (other !== x && squaresOnFile(board, piece, other, side).length > 1) return true;
  }
  return false;
}

/** 以中文記譜法描述一步棋（如「炮二平五」）。需在走子前呼叫。 */
export function moveNotation(board: Int8Array, from: number, to: number): string {
  const piece = board[from]!;
  const side = pieceSide(piece);
  const kind = pieceKind(piece);
  const fromX = fileOf(from);
  const toX = fileOf(to);
  const advance = side === RED ? rankOf(from) - rankOf(to) : rankOf(to) - rankOf(from);
  const glyph = pieceGlyph(piece);

  const sameFile = squaresOnFile(board, piece, fromX, side);
  let subject = `${glyph}${fileLabel(fromX, side)}`;
  if (sameFile.length > 1) {
    const prefix = tandemPrefix(sameFile.indexOf(from), sameFile.length);
    const ambiguous = kind === SOLDIER && hasOtherTandemFile(board, piece, fromX, side);
    subject = ambiguous ? `${prefix}${fileLabel(fromX, side)}` : `${prefix}${glyph}`;
  }

  if (advance === 0) return `${subject}平${fileLabel(toX, side)}`;
  const action = advance > 0 ? '進' : '退';
  const movesDiagonally = kind === HORSE || kind === ELEPHANT || kind === ADVISOR;
  const amount = movesDiagonally ? fileLabel(toX, side) : stepLabel(Math.abs(advance), side);
  return `${subject}${action}${amount}`;
}
