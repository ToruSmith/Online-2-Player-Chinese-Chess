import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { judgeMoves, redWinPercent } from '../../src/engine/ai/review';
import { MATE } from '../../src/engine/ai/search';

describe('賽後分析', () => {
  test('分數以走子方為準，下一個局面要反過來看', () => {
    assert.deepEqual(judgeMoves([0, 0]), ['good']);
    assert.deepEqual(judgeMoves([0, 50]), ['inaccuracy']);
    assert.deepEqual(judgeMoves([0, 100]), ['mistake']);
    assert.deepEqual(judgeMoves([0, 200]), ['blunder']);
    assert.deepEqual(judgeMoves([100, -100]), ['good']);
  });

  test('對局結束或只有一種走法的局面不評語', () => {
    assert.deepEqual(judgeMoves([0, null]), ['good']);
    assert.deepEqual(judgeMoves([null, 500, 0]), ['good', 'blunder']);
  });

  test('殺棋分數會封頂，放過殺棋算大失誤', () => {
    assert.deepEqual(judgeMoves([MATE - 3, 0]), ['blunder']);
    assert.deepEqual(judgeMoves([MATE - 3, -(MATE - 5)]), ['good']);
  });

  test('勝率依輪到誰換邊', () => {
    assert.equal(redWinPercent(0, true), 50);
    assert.ok(redWinPercent(200, true) > 80);
    assert.ok(redWinPercent(200, false) < 20);
  });
});
