import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createGame,
  encodeMove,
  legalMovesOf,
  moveFrom,
  moveTo,
  playMove,
  takeBack,
  toSquare,
} from '../../src/engine';
import { LEVELS, chooseMove, levelById } from '../../src/engine/ai/levels';
import { MATE, searchBestMove } from '../../src/engine/ai/search';

const quick = { maxDepth: 4, timeMs: 400 };

describe('AI', () => {
  test('有殺棋時會走殺棋', () => {
    const game = createGame('4k4/9/4N4/9/9/9/9/2C6/9/3K5 w');
    const result = searchBestMove(game, quick)!;
    assert.equal(result.move, encodeMove(toSquare(2, 7), toSquare(4, 7)));
    assert.ok(result.score > MATE - 10);
  });

  test('會吃掉沒有保護的車', () => {
    const game = createGame('4k4/9/9/9/9/r7R/9/9/9/5K3 w');
    const result = searchBestMove(game, quick)!;
    assert.equal(result.move, encodeMove(toSquare(8, 5), toSquare(0, 5)));
  });

  test('被將軍時回傳的走法一定合法', () => {
    const game = createGame('3k5/9/9/9/9/9/9/4r4/9/3AK4 w');
    const result = searchBestMove(game, quick)!;
    assert.ok(legalMovesOf(game).includes(result.move));
  });

  test('無路可走時回傳 null', () => {
    const game = createGame('3k5/2R1R4/9/9/9/9/9/9/9/5K3 b');
    assert.equal(searchBestMove(game, quick), null);
    assert.equal(chooseMove(game, levelById('club')), null);
  });

  test('不會走出造成長將判負的棋', () => {
    let game = createGame('4k4/R8/9/9/9/9/9/9/9/3K5 w');
    const loop = [
      [toSquare(0, 1), toSquare(0, 0)],
      [toSquare(4, 0), toSquare(4, 1)],
      [toSquare(0, 0), toSquare(0, 1)],
      [toSquare(4, 1), toSquare(4, 0)],
    ] as const;
    for (const [from, to] of [...loop, ...loop.slice(0, 3)]) game = playMove(game, from, to)!;
    assert.ok(game);
    assert.equal(game.turn, 'black');
    game = playMove(game, toSquare(4, 1), toSquare(4, 0))!;
    assert.equal(game.outcome?.reason, 'perpetual-check');

    const before = takeBack(game, 1);
    const reply = searchBestMove(before, quick)!;
    const after = playMove(before, moveFrom(reply.move), moveTo(reply.move))!;
    assert.notEqual(after.outcome?.winner, 'red');
  });

  test('每個難度都能走完開局而不犯規', () => {
    for (const level of LEVELS) {
      let game = createGame();
      for (let ply = 0; ply < 4; ply += 1) {
        const result = chooseMove(game, { ...level, timeMs: Math.min(level.timeMs, 100) })!;
        const next = playMove(game, moveFrom(result.move), moveTo(result.move));
        assert.ok(next, `${level.name} 走了不合法的棋`);
        game = next;
      }
    }
  });
});
