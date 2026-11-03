import { INITIAL_FEN, type Color, toSquare } from './constants';
import { parseFen, toFen } from './fen';

export type HandicapKind = 'none' | 'horse' | 'cannon' | 'chariot' | 'two-horses' | 'chariot-horse';

export const HANDICAPS: readonly { kind: HandicapKind; label: string }[] = [
  { kind: 'none', label: '不讓子' },
  { kind: 'horse', label: '讓一馬' },
  { kind: 'cannon', label: '讓一炮' },
  { kind: 'chariot', label: '讓一車' },
  { kind: 'two-horses', label: '讓雙馬' },
  { kind: 'chariot-horse', label: '讓車馬' },
];

/** 以 [x, 底線距離] 表示要拿掉的棋子，x 為紅方視角左側的棋子。 */
const REMOVED: Record<HandicapKind, readonly (readonly [number, number])[]> = {
  none: [],
  horse: [[1, 0]],
  cannon: [[1, 2]],
  chariot: [[0, 0]],
  'two-horses': [
    [1, 0],
    [7, 0],
  ],
  'chariot-horse': [
    [0, 0],
    [1, 0],
  ],
};

/** 回傳讓子後的開局 FEN。`giver` 是讓子的一方。 */
export function handicapFen(giver: Color, kind: HandicapKind): string {
  const { board, turn } = parseFen(INITIAL_FEN);
  for (const [x, fromBaseline] of REMOVED[kind]) {
    const square = giver === 'red' ? toSquare(x, 9 - fromBaseline) : toSquare(8 - x, fromBaseline);
    board[square] = 0;
  }
  return toFen(board, turn);
}
