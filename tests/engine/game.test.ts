import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  NO_CAPTURE_LIMIT,
  createGame,
  endGame,
  handicapFen,
  legalMoves,
  moveFrom,
  moveNotation,
  moveTo,
  parseFen,
  playMove,
  replay,
  RED,
  takeBack,
  toFen,
  toSquare,
  type Game,
} from '../../src/engine';

const sq = toSquare;
const must = (game: Game | null): Game => {
  assert.ok(game, '走法應該合法');
  return game;
};
const play = (game: Game, ...steps: [number, number, number, number][]): Game =>
  steps.reduce((g, [x1, y1, x2, y2]) => must(playMove(g, sq(x1, y1), sq(x2, y2))), game);

describe('終局判定', () => {
  test('絕殺時由走棋方獲勝', () => {
    const game = createGame('3k5/R8/9/9/9/9/9/9/9/1R2K4 w');
    const end = must(playMove(game, sq(1, 9), sq(1, 0)));
    assert.deepEqual(end.outcome, { winner: 'red', reason: 'checkmate' });
  });

  test('困斃判無子可走的一方輸，不是平手', () => {
    const trapped = createGame('3k5/2R1R4/9/9/9/9/9/9/9/5K3 b');
    assert.equal(trapped.inCheck, false);
    assert.deepEqual(trapped.outcome, { winner: 'red', reason: 'stalemate' });
  });

  test('同一局面出現三次且無人長將時判和', () => {
    let game = createGame('4k4/9/9/9/9/9/9/9/9/R2K5 w');
    const loop: [number, number, number, number][] = [
      [0, 9, 0, 8],
      [4, 0, 4, 1],
      [0, 8, 0, 9],
      [4, 1, 4, 0],
    ];
    game = play(game, ...loop);
    assert.equal(game.outcome, null);
    game = play(game, ...loop);
    assert.deepEqual(game.outcome, { winner: null, reason: 'repetition' });
  });

  test('單方反覆將軍造成循環時，長將方判負', () => {
    let game = createGame('4k4/R8/9/9/9/9/9/9/9/3K5 w');
    const loop: [number, number, number, number][] = [
      [0, 1, 0, 0],
      [4, 0, 4, 1],
      [0, 0, 0, 1],
      [4, 1, 4, 0],
    ];
    game = play(game, ...loop);
    assert.equal(game.outcome, null);
    game = play(game, ...loop);
    assert.deepEqual(game.outcome, { winner: 'black', reason: 'perpetual-check' });
  });

  test('連續 60 回合未吃子判和', () => {
    const base = createGame('4k4/9/9/9/9/9/9/9/9/R2K5 w');
    const nearLimit: Game = { ...base, quietPlies: NO_CAPTURE_LIMIT - 1 };
    const next = must(playMove(nearLimit, sq(0, 9), sq(0, 5)));
    assert.deepEqual(next.outcome, { winner: null, reason: 'no-capture' });
  });

  test('雙方都沒有攻擊子時判和', () => {
    const dry = createGame('4k4/4a4/9/9/9/9/9/9/4A4/3K5 w');
    assert.deepEqual(dry.outcome, { winner: null, reason: 'insufficient' });
  });

  test('終局後不能再走棋，認輸也不會覆蓋既有結果', () => {
    const ended = endGame(createGame(), { winner: 'black', reason: 'resign' });
    assert.equal(playMove(ended, sq(0, 6), sq(0, 5)), null);
    assert.equal(endGame(ended, { winner: 'red', reason: 'timeout' }).outcome?.reason, 'resign');
  });
});

describe('走子與悔棋', () => {
  test('不合法的走法會被拒絕，且不改變原本的對局', () => {
    const game = createGame();
    const before = toFen(game.board, game.turn);
    assert.equal(playMove(game, sq(0, 9), sq(0, 3)), null);
    assert.equal(playMove(game, sq(0, 0), sq(0, 1)), null, '不是黑方的回合');
    assert.equal(toFen(game.board, game.turn), before);
  });

  test('悔棋會還原局面並清除終局', () => {
    const start = createGame('3k5/R8/9/9/9/9/9/9/9/1R2K4 w');
    const end = must(playMove(start, sq(1, 9), sq(1, 0)));
    const back = takeBack(end, 1);
    assert.equal(back.outcome, null);
    assert.equal(back.moves.length, 0);
    assert.equal(toFen(back.board, back.turn), toFen(start.board, start.turn));
  });

  test('棋譜可以完整重播', () => {
    const game = play(createGame(), [7, 7, 4, 7], [7, 0, 6, 2]);
    const again = replay(
      game.initialFen,
      game.moves.map((m) => [m.from, m.to] as const),
    );
    assert.equal(toFen(again.board, again.turn), toFen(game.board, game.turn));
    assert.throws(() => replay(game.initialFen, [[0, 1]]));
  });

  test('隨機對局的每一步都能重播出相同局面', () => {
    let seed = 20261103;
    const random = (limit: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % limit;
    };
    for (let round = 0; round < 20; round += 1) {
      let game = createGame();
      while (!game.outcome && game.moves.length < 300) {
        const moves = legalMoves(game.board, game.turn === 'red' ? RED : -1);
        const move = moves[random(moves.length)]!;
        game = must(playMove(game, moveFrom(move), moveTo(move)));
      }
      const again = replay(
        game.initialFen,
        game.moves.map((m) => [m.from, m.to] as const),
      );
      assert.equal(again.positions.at(-1), game.positions.at(-1));
    }
  });
});

describe('中文記譜', () => {
  const name = (fen: string, x1: number, y1: number, x2: number, y2: number) =>
    moveNotation(parseFen(fen).board, sq(x1, y1), sq(x2, y2));
  const start = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';

  test('常見開局', () => {
    assert.equal(name(start, 7, 7, 4, 7), '炮二平五');
    assert.equal(name(start, 7, 9, 6, 7), '馬二進三');
    assert.equal(name(start, 1, 0, 2, 2), '馬2進3');
    assert.equal(name(start, 7, 2, 4, 2), '砲8平5');
    assert.equal(name(start, 0, 9, 0, 8), '俥九進一');
    assert.equal(name(start, 2, 6, 2, 5), '兵七進一');
    assert.equal(name(start, 6, 9, 4, 7), '相三進五');
    assert.equal(name(start, 3, 9, 4, 8), '仕六進五');
  });

  test('退與平', () => {
    assert.equal(name('3k5/9/9/9/9/9/R8/9/9/4K4 w', 0, 6, 0, 9), '俥九退三');
    assert.equal(name('3k5/9/9/9/9/9/9/9/9/R3K4 w', 0, 9, 3, 9), '俥九平六');
    assert.equal(name('3k5/9/9/9/r8/9/9/9/9/4K4 b', 0, 4, 0, 2), '車1退2');
  });

  test('同路同種棋子用前後區分', () => {
    const fen = '3k5/9/9/R8/9/9/9/R8/9/4K4 w';
    assert.equal(name(fen, 0, 3, 0, 2), '前俥進一');
    assert.equal(name(fen, 0, 7, 0, 8), '後俥退一');
    const blackFen = '3k5/9/r8/9/9/9/r8/9/9/4K4 b';
    assert.equal(name(blackFen, 0, 6, 0, 7), '前車進1');
    assert.equal(name(blackFen, 0, 2, 0, 1), '後車退1');
  });

  test('三兵同路用前中後，多路疊兵時改用路數', () => {
    const fen = '3k5/9/P8/P8/P8/9/9/9/9/5K3 w';
    assert.equal(name(fen, 0, 3, 1, 3), '中兵平八');
    const two = '3k5/9/P1P6/P1P6/9/9/9/9/9/5K3 w';
    assert.equal(name(two, 0, 2, 0, 1), '前九進一');
  });
});

describe('讓子', () => {
  test('讓子方少了對應的棋子，其他棋子不變', () => {
    const count = (fen: string, predicate: (p: number) => boolean) =>
      parseFen(fen).board.reduce((n, p) => n + (predicate(p) ? 1 : 0), 0);
    assert.equal(
      count(handicapFen('red', 'chariot'), (p) => p === 5),
      1,
    );
    assert.equal(
      count(handicapFen('red', 'chariot'), (p) => p === -5),
      2,
    );
    assert.equal(
      count(handicapFen('black', 'two-horses'), (p) => p === -4),
      0,
    );
    assert.equal(
      count(handicapFen('black', 'cannon'), (p) => p === -6),
      1,
    );
    assert.equal(handicapFen('red', 'none'), createGame().initialFen);
  });
});

describe('長捉', () => {
  const start = (extra = '9') => createGame(`5k3/9/${extra}/4n4/9/2R6/9/9/9/3K5 w`);
  const CYCLE: [number, number][] = [
    [toSquare(2, 5), toSquare(4, 5)],
    [toSquare(4, 3), toSquare(2, 2)],
    [toSquare(4, 5), toSquare(2, 5)],
    [toSquare(2, 2), toSquare(4, 3)],
  ];
  const playCycles = (game: Game, cycles: number): Game => {
    let current = game;
    for (let round = 0; round < cycles; round += 1) {
      for (const [from, to] of CYCLE) current = playMove(current, from, to) ?? current;
    }
    return current;
  };

  test('車一直追沒有保護的馬，追的一方判負', () => {
    const game = playCycles(start(), 2);
    assert.deepEqual(game.outcome, { winner: 'black', reason: 'perpetual-chase' });
  });

  test('被追的棋子有保護就不算捉，判和', () => {
    const game = playCycles(start('r8'), 2);
    assert.deepEqual(game.outcome, { winner: null, reason: 'repetition' });
  });
});
