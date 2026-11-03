import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PUZZLES, createGame, moveFrom, moveTo, playMove } from '../../src/engine';
import { toughestDefense, winningMoves } from '../../src/engine/ai/solver';

describe('殘局題庫', () => {
  test('題目編號不重複', () => {
    assert.equal(new Set(PUZZLES.map((p) => p.id)).size, PUZZLES.length);
  });

  for (const puzzle of PUZZLES) {
    test(`${puzzle.title}：剛好 ${puzzle.moves} 步殺`, () => {
      const game = createGame(puzzle.fen);
      assert.equal(game.turn, 'red');
      assert.equal(game.outcome, null);
      assert.equal(game.inCheck, false, '開局時黑方不應該已被將軍以外的狀態影響');
      for (let shorter = 1; shorter < puzzle.moves; shorter += 1) {
        assert.equal(winningMoves(game, shorter).length, 0, `不應存在 ${shorter} 步殺`);
      }
      const keys = winningMoves(game, puzzle.moves);
      assert.ok(keys.length >= 1 && keys.length <= 2, `解法數量異常：${keys.length}`);
    });

    test(`${puzzle.title}：沿著主線能走到絕殺`, () => {
      let game = createGame(puzzle.fen);
      for (let left = puzzle.moves; left >= 1; left -= 1) {
        const move = winningMoves(game, left)[0]!;
        game = playMove(game, moveFrom(move), moveTo(move))!;
        if (game.outcome) break;
        const reply = toughestDefense(game, left - 1)!;
        game = playMove(game, moveFrom(reply), moveTo(reply))!;
      }
      assert.equal(game.outcome?.winner, 'red');
      assert.equal(game.outcome?.reason, 'checkmate');
    });
  }
});
