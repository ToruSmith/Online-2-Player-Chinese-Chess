/**
 * 棋盤座標與棋子編碼。
 *
 * 格子以 0–89 表示：`square = y * 9 + x`。
 * x 由左到右（紅方視角）為 0–8；y 由上到下為 0–9，黑方在上、紅方在下。
 * 棋子為帶正負號的整數：正數是紅方、負數是黑方，0 是空格。
 */

export const FILES = 9;
export const RANKS = 10;
export const SQUARES = FILES * RANKS;

export const RED = 1;
export const BLACK = -1;
export type Side = typeof RED | typeof BLACK;
export type Color = 'red' | 'black';

export const GENERAL = 1;
export const ADVISOR = 2;
export const ELEPHANT = 3;
export const HORSE = 4;
export const CHARIOT = 5;
export const CANNON = 6;
export const SOLDIER = 7;
export type PieceKind = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const toSquare = (x: number, y: number): number => y * FILES + x;
export const fileOf = (square: number): number => square % FILES;
export const rankOf = (square: number): number => Math.floor(square / FILES);
export const isOnBoard = (x: number, y: number): boolean =>
  x >= 0 && x < FILES && y >= 0 && y < RANKS;

export const sideOf = (color: Color): Side => (color === 'red' ? RED : BLACK);
export const colorOf = (side: Side): Color => (side === RED ? 'red' : 'black');
export const opposite = (color: Color): Color => (color === 'red' ? 'black' : 'red');
export const pieceSide = (piece: number): Side => (piece > 0 ? RED : BLACK);
export const pieceKind = (piece: number): PieceKind => Math.abs(piece) as PieceKind;

export const INITIAL_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';

const GLYPHS: Record<Color, Record<PieceKind, string>> = {
  red: { 1: '帥', 2: '仕', 3: '相', 4: '馬', 5: '俥', 6: '炮', 7: '兵' },
  black: { 1: '將', 2: '士', 3: '象', 4: '馬', 5: '車', 6: '砲', 7: '卒' },
};

/** 取得棋子在棋盤上顯示的字。 */
export const pieceGlyph = (piece: number): string =>
  GLYPHS[colorOf(pieceSide(piece))][pieceKind(piece)];
