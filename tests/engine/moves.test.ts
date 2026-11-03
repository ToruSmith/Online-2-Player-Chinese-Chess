import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BLACK,
  RED,
  type Side,
  createGame,
  encodeMove,
  generatePseudoMoves,
  isInCheck,
  legalMoves,
  legalTargets,
  moveFrom,
  moveTo,
  parseFen,
  toSquare,
} from '../../src/engine';

function perft(board: Int8Array, side: Side, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(board, side);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    const from = moveFrom(move);
    const to = moveTo(move);
    const moved = board[from]!;
    const captured = board[to]!;
    board[to] = moved;
    board[from] = 0;
    nodes += perft(board, -side as Side, depth - 1);
    board[from] = moved;
    board[to] = captured;
  }
  return nodes;
}

const targets = (fen: string, x: number, y: number) =>
  legalTargets(parseFen(fen).board, toSquare(x, y)).sort((a, b) => a - b);
const squares = (...coords: [number, number][]) =>
  coords.map(([x, y]) => toSquare(x, y)).sort((a, b) => a - b);

describe('走法生成', () => {
  test('開局 perft 符合公認數值', () => {
    const { board } = parseFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w');
    assert.equal(perft(board, RED, 1), 44);
    assert.equal(perft(board, RED, 2), 1920);
    assert.equal(perft(board, RED, 3), 79666);
    assert.equal(perft(board, RED, 4), 3290240);
  });

  test('馬被蹩腳時不能往該方向跳', () => {
    const free = targets('3k5/9/9/9/9/4N4/9/9/9/4K4 w', 4, 5);
    assert.equal(free.length, 8);
    const blocked = targets('3k5/9/9/9/4p4/4N4/9/9/9/4K4 w', 4, 5);
    assert.deepEqual(blocked, squares([2, 4], [6, 4], [2, 6], [6, 6], [3, 7], [5, 7]));
  });

  test('象被塞象眼時不能走，也不能過河', () => {
    const start = '3k5/9/9/9/9/9/9/9/9/2B1K4 w';
    assert.deepEqual(targets(start, 2, 9), squares([0, 7], [4, 7]));
    assert.deepEqual(targets('3k5/9/9/9/9/9/9/9/3p5/2B1K4 w', 2, 9), squares([0, 7]));
    assert.deepEqual(targets('3k5/9/9/9/9/9/9/9/1p7/2B1K4 w', 2, 9), squares([4, 7]));
    assert.deepEqual(targets('3k5/9/9/9/9/2B6/9/9/9/4K4 w', 2, 5), squares([0, 7], [4, 7]));
  });

  test('炮要隔一子才能吃，不隔子時只能走空格', () => {
    const fen = '3k5/9/9/9/4r4/4P4/9/9/4C4/5K3 w';
    const moves = targets(fen, 4, 8);
    assert.ok(moves.includes(toSquare(4, 4)), '應能隔著兵吃車');
    assert.ok(!moves.includes(toSquare(4, 5)), '不能吃自己的兵');
    assert.ok(moves.includes(toSquare(4, 6)));
  });

  test('兵過河前只能前進，過河後可以左右走，但不能後退', () => {
    assert.deepEqual(targets('3k5/9/9/9/9/4P4/9/9/9/5K3 w', 4, 5), squares([4, 4]));
    assert.deepEqual(targets('3k5/9/9/9/4P4/9/9/9/9/5K3 w', 4, 4), squares([4, 3], [3, 4], [5, 4]));
  });

  test('兩將不能照面，擋在中間的子不能離開', () => {
    const fen = '4k4/9/9/9/9/4R4/9/9/9/4K4 w';
    const moves = targets(fen, 4, 5);
    assert.ok(
      moves.every((square) => square % 9 === 4),
      '車只能在中路上移動',
    );
  });

  test('被將軍時只能走解將的棋', () => {
    const { board } = parseFen('4k4/9/9/9/9/9/9/4r4/9/3AK4 w');
    assert.equal(isInCheck(board, RED), true);
    const moves = legalMoves(board, RED);
    assert.deepEqual(
      moves.sort((a, b) => a - b),
      [
        encodeMove(toSquare(3, 9), toSquare(4, 8)), // 撐仕擋車
        encodeMove(toSquare(4, 9), toSquare(5, 9)), // 帥閃開
      ].sort((a, b) => a - b),
    );
  });

  test('各種將軍都能被偵測到', () => {
    const check = (fen: string, side: Side) => isInCheck(parseFen(fen).board, side);
    assert.equal(check('4k4/9/9/9/9/9/9/4r4/9/4K4 w', RED), true, '車');
    assert.equal(check('3k5/9/9/9/9/9/9/4c4/4p4/4K4 w', RED), true, '炮');
    assert.equal(check('3k5/9/9/9/9/9/9/5n3/9/4K4 w', RED), true, '馬');
    assert.equal(check('3k5/9/9/9/9/9/9/9/4p4/4K4 w', RED), true, '卒在前方');
    assert.equal(check('3k5/9/9/9/9/9/9/9/9/3pK4 w', RED), true, '卒在側面');
    assert.equal(check('3k5/9/9/9/9/9/9/5n3/5A3/4K4 w', RED), false, '馬被蹩腳');
    assert.equal(check('4k4/4P4/9/9/9/9/9/9/9/3K5 b', BLACK), true, '兵將黑方');
  });

  test('只產生吃子走法時，每一步都是吃子', () => {
    const { board } = parseFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w');
    const captures: number[] = [];
    generatePseudoMoves(board, RED, captures, true);
    assert.ok(captures.length > 0);
    assert.ok(captures.every((move) => board[moveTo(move)]! < 0));
  });
});

describe('局面', () => {
  test('缺少將帥的局面會被拒絕', () => {
    assert.throws(() => createGame('9/9/9/9/9/9/9/9/9/4K4 w'));
  });
});
