import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createGame, playMove, replay, toSquare } from '../../src/engine';
import { DEMO_GAME, DEMO_MOVES } from '../../src/client/lib/demoGame';
import { boardAt, capturedBy, trackPieces } from '../../src/client/lib/pieces';

describe('棋子追蹤', () => {
  test('同一顆棋子移動後身分不變', () => {
    const game = playMove(createGame(), toSquare(7, 7), toSquare(4, 7))!;
    const before = trackPieces(game, 0).find((piece) => piece.square === toSquare(7, 7))!;
    const after = trackPieces(game, 1).find((piece) => piece.id === before.id)!;
    assert.equal(after.square, toSquare(4, 7));
  });

  test('被吃掉的棋子會消失，吃子紀錄也正確', () => {
    // 炮二進七吃馬。
    const game = playMove(createGame(), toSquare(7, 7), toSquare(7, 0))!;
    assert.equal(trackPieces(game, 0).length, 32);
    assert.equal(trackPieces(game, 1).length, 31);
    assert.deepEqual(capturedBy(game, 1, 1), [-4]);
    assert.deepEqual(capturedBy(game, -1, 1), []);
    assert.deepEqual(capturedBy(game, 1, 0), []);
  });

  test('任何步數的棋盤都和重播結果一致', () => {
    for (let ply = 0; ply <= DEMO_MOVES.length; ply += 1) {
      const expected = replay(DEMO_GAME.initialFen, DEMO_MOVES.slice(0, ply)).board;
      assert.deepEqual(boardAt(DEMO_GAME, ply), expected);
      const tracked = new Int8Array(90);
      for (const { piece, square } of trackPieces(DEMO_GAME, ply)) tracked[square] = piece;
      assert.deepEqual(tracked, expected);
    }
  });
});
