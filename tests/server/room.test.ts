import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { toSquare } from '../../src/engine';
import { RoomError } from '../../src/server/errors';
import { Room } from '../../src/server/room';
import { RoomManager } from '../../src/server/roomManager';
import { DEFAULT_ROOM_OPTIONS, type RoomOptions } from '../../src/shared/protocol';

let clock = 0;
let tokenCount = 0;
const deps = {
  now: () => clock,
  createToken: () => `token-${(tokenCount += 1)}`,
  random: () => 0.1,
};

function seatedRoom(options: Partial<RoomOptions> = {}) {
  const room = new Room('1234', { ...DEFAULT_ROOM_OPTIONS, ...options }, '爸爸', deps);
  const guest = room.join('小明');
  const redToken = room.roleOf(room.token) === 'red' ? room.token : guest.token;
  const blackToken = redToken === room.token ? guest.token : room.token;
  return { room, red: redToken, black: blackToken };
}

const code = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof RoomError) return error.code;
    throw error;
  }
  return 'ok';
};

// 炮二平五 / 砲8平5 / 馬二進三
const redCannon = [toSquare(7, 7), toSquare(4, 7)] as const;
const blackCannon = [toSquare(7, 2), toSquare(4, 2)] as const;
const redHorse = [toSquare(7, 9), toSquare(6, 7)] as const;

beforeEach(() => {
  clock = 1_000_000;
  tokenCount = 0;
});

describe('棋步驗證', () => {
  test('對手入座前不能走棋', () => {
    const room = new Room('1234', DEFAULT_ROOM_OPTIONS, '爸爸', deps);
    assert.equal(room.status, 'waiting');
    assert.equal(
      code(() => room.move(room.token, ...redCannon, 0)),
      'game-not-active',
    );
  });

  test('拒絕不是自己回合的走法', () => {
    const { room, black } = seatedRoom();
    assert.equal(
      code(() => room.move(black, ...blackCannon, 0)),
      'not-your-turn',
    );
  });

  test('拒絕不合法的走法，棋局不變', () => {
    const { room, red } = seatedRoom();
    assert.equal(
      code(() => room.move(red, toSquare(0, 9), toSquare(0, 2), 0)),
      'illegal-move',
    );
    assert.equal(room.view('red').moves.length, 0);
  });

  test('拒絕依據舊局面送出的走法', () => {
    const { room, red, black } = seatedRoom();
    room.move(red, ...redCannon, 0);
    assert.equal(
      code(() => room.move(black, ...blackCannon, 0)),
      'stale-position',
    );
  });

  test('觀戰者不能操作', () => {
    const { room } = seatedRoom();
    const visitor = room.join('阿姨');
    assert.equal(visitor.role, 'spectator');
    assert.equal(
      code(() => room.move(visitor.token, ...redCannon, 0)),
      'not-a-player',
    );
    assert.equal(
      code(() => room.resign(visitor.token)),
      'not-a-player',
    );
  });

  test('觀戰人數有上限', () => {
    const { room } = seatedRoom();
    for (let count = 0; count < 8; count += 1) room.join('訪客');
    assert.equal(
      code(() => room.join('訪客')),
      'room-full',
    );
    room.removeSpectator();
    assert.equal(room.join('訪客').role, 'spectator');
  });
});

describe('座位', () => {
  test('離線後座位會保留，別人搶不走', () => {
    const { room, black } = seatedRoom();
    room.setConnected(black, false);
    assert.equal(room.view('red').seats.black?.connected, false);
    assert.equal(room.join('路人').role, 'spectator');
    assert.deepEqual(room.join('小明', black), { role: 'black', token: black });
    assert.equal(room.view('red').seats.black?.connected, true);
  });

  test('用無效的 token 無法冒充玩家', () => {
    const { room } = seatedRoom();
    assert.equal(room.join('駭客', 'token-999').role, 'spectator');
  });

  test('房主可選執黑，也可隨機', () => {
    const asBlack = new Room('1', { ...DEFAULT_ROOM_OPTIONS, hostColor: 'black' }, 'A', deps);
    assert.equal(asBlack.roleOf(asBlack.token), 'black');
    assert.equal(asBlack.join('B').role, 'red');
    const random = new Room('2', { ...DEFAULT_ROOM_OPTIONS, hostColor: 'random' }, 'A', deps);
    assert.equal(random.roleOf(random.token), 'red');
  });

  test('讓子時由房主那一方少子', () => {
    const { room } = seatedRoom({ handicap: 'chariot', hostColor: 'red' });
    assert.ok(room.view('red').initialFen.endsWith('1NBAKABNR w'));
  });
});

describe('雙方協商', () => {
  test('悔棋需要對方同意，同意後退回自己走棋之前', () => {
    const { room, red, black } = seatedRoom();
    room.move(red, ...redCannon, 0);
    room.propose(red, 'undo');
    assert.deepEqual(room.view('red').proposal, { kind: 'undo', from: 'red' });
    assert.equal(room.view('red').moves.length, 1, '同意前不會改變棋局');
    assert.equal(room.respond(black, true), 'undo');
    assert.equal(room.view('red').moves.length, 0);
    assert.equal(room.view('red').proposal, null);
  });

  test('輪到自己時悔棋會多退一步，回到自己的回合', () => {
    const { room, red, black } = seatedRoom();
    room.move(red, ...redCannon, 0);
    room.move(black, ...blackCannon, 1);
    room.propose(red, 'undo');
    room.respond(black, true);
    assert.equal(room.view('red').moves.length, 0);
  });

  test('拒絕悔棋時棋局不變，提出者不能自己同意', () => {
    const { room, red, black } = seatedRoom();
    room.move(red, ...redCannon, 0);
    room.propose(red, 'undo');
    assert.equal(
      code(() => room.respond(red, true)),
      'no-proposal',
    );
    room.respond(black, false);
    assert.equal(room.view('red').moves.length, 1);
  });

  test('開局第一步之前沒有棋可悔', () => {
    const { room, red, black } = seatedRoom();
    assert.equal(
      code(() => room.propose(red, 'undo')),
      'nothing-to-undo',
    );
    room.move(red, ...redCannon, 0);
    assert.equal(
      code(() => room.propose(black, 'undo')),
      'nothing-to-undo',
    );
  });

  test('走下一步時，尚未回覆的請求自動失效', () => {
    const { room, red, black } = seatedRoom();
    room.move(red, ...redCannon, 0);
    room.propose(red, 'draw');
    room.move(black, ...blackCannon, 1);
    assert.equal(room.view('red').proposal, null);
  });

  test('同時只能有一個請求，提出者可以取消', () => {
    const { room, red, black } = seatedRoom();
    room.propose(red, 'draw');
    assert.equal(
      code(() => room.propose(black, 'draw')),
      'proposal-pending',
    );
    assert.equal(
      code(() => room.cancelProposal(black)),
      'no-proposal',
    );
    room.cancelProposal(red);
    assert.equal(room.view('red').proposal, null);
  });

  test('議和與認輸會結束對局', () => {
    const first = seatedRoom();
    first.room.propose(first.red, 'draw');
    first.room.respond(first.black, true);
    assert.deepEqual(first.room.view('red').outcome, { winner: null, reason: 'agreement' });

    const second = seatedRoom();
    second.room.resign(second.red);
    assert.deepEqual(second.room.view('red').outcome, { winner: 'black', reason: 'resign' });
    assert.equal(
      code(() => second.room.resign(second.red)),
      'game-not-active',
    );
    assert.equal(
      code(() => second.room.propose(second.red, 'undo')),
      'game-not-active',
    );
  });

  test('重賽時雙方換邊，讓子仍由房主負擔', () => {
    const { room, red, black } = seatedRoom({ handicap: 'chariot', timeControl: 'quick' });
    assert.equal(
      code(() => room.propose(red, 'rematch')),
      'game-not-active',
    );
    room.resign(black);
    room.propose(black, 'rematch');
    room.respond(red, true);
    assert.equal(room.roleOf(red), 'black');
    assert.equal(room.roleOf(black), 'red');
    const view = room.view('red');
    assert.equal(view.round, 2);
    assert.equal(view.status, 'playing');
    assert.equal(view.moves.length, 0);
    assert.ok(view.initialFen.startsWith('rnbakabn1/'), '房主現在執黑，少的是黑車');
    assert.equal(view.clock?.red, 5 * 60_000);
  });
});

describe('棋鐘', () => {
  test('第一步走完才開始計時，走棋後加秒', () => {
    const { room, red, black } = seatedRoom({ timeControl: 'quick' });
    clock += 10_000;
    assert.equal(room.view('red').clock?.running, null);
    room.move(red, ...redCannon, 0);
    assert.equal(room.view('red').clock?.red, 5 * 60_000, '第一步不扣時也不加時');
    assert.equal(room.view('red').clock?.running, 'black');

    clock += 4_000;
    assert.equal(room.view('red').clock?.black, 5 * 60_000 - 4_000);
    room.move(black, ...blackCannon, 1);
    assert.equal(room.view('red').clock?.black, 5 * 60_000 - 4_000 + 3_000);
    assert.equal(room.view('red').clock?.running, 'red');
  });

  test('有人離線時暫停，回來後繼續', () => {
    const { room, red, black } = seatedRoom({ timeControl: 'quick' });
    room.move(red, ...redCannon, 0);
    clock += 2_000;
    room.setConnected(red, false);
    clock += 60_000;
    assert.equal(room.view('black').clock?.running, null);
    assert.equal(room.view('black').clock?.black, 5 * 60_000 - 2_000);
    room.join('爸爸', red);
    clock += 1_000;
    assert.equal(room.view('black').clock?.black, 5 * 60_000 - 3_000);
    assert.equal(black.length > 0, true);
  });

  test('時間用完判負', () => {
    const { room, red } = seatedRoom({ timeControl: 'quick' });
    room.move(red, ...redCannon, 0);
    clock += 299_000;
    assert.equal(room.tick(), false);
    clock += 2_000;
    assert.equal(room.tick(), true);
    assert.deepEqual(room.view('red').outcome, { winner: 'red', reason: 'timeout' });
    assert.equal(room.view('red').clock?.black, 0);
    assert.equal(room.view('red').clock?.running, null);
    assert.equal(room.tick(), false);
  });

  test('悔棋後由回到回合的一方繼續計時', () => {
    const { room, red, black } = seatedRoom({ timeControl: 'quick' });
    room.move(red, ...redCannon, 0);
    room.move(black, ...blackCannon, 1);
    room.move(red, ...redHorse, 2);
    clock += 1_000;
    room.propose(red, 'undo');
    room.respond(black, true);
    assert.equal(room.view('red').clock?.running, 'red');
  });

  test('不限時的房間沒有棋鐘', () => {
    const { room, red } = seatedRoom();
    room.move(red, ...redCannon, 0);
    assert.equal(room.view('red').clock, null);
    assert.equal(room.tick(), false);
  });
});

describe('房間管理', () => {
  const manager = (maxRooms = 3, sequence: number[] = []) => {
    let index = 0;
    return new RoomManager(
      { maxRooms, idleTtlMs: 60_000 },
      { ...deps, random: () => sequence[index++] ?? Math.random() },
    );
  };

  test('房號固定為四位數，且不會重複', () => {
    const rooms = manager(3, [0.5, 0.5, 0.5, 0.25]);
    const first = rooms.create('A', DEFAULT_ROOM_OPTIONS);
    const second = rooms.create('B', DEFAULT_ROOM_OPTIONS);
    assert.match(first.code, /^\d{4}$/);
    assert.notEqual(first.code, second.code);
  });

  test('達到房間上限時拒絕建立', () => {
    const rooms = manager(1);
    rooms.create('A', DEFAULT_ROOM_OPTIONS);
    assert.equal(
      code(() => rooms.create('B', DEFAULT_ROOM_OPTIONS)),
      'server-busy',
    );
  });

  test('所有人離開且逾時後才回收房間', () => {
    const rooms = manager();
    const room = rooms.create('A', DEFAULT_ROOM_OPTIONS);
    rooms.sweep();
    assert.equal(rooms.size, 1, '有人在線上時不回收');
    room.setConnected(room.token, false);
    clock += 30_000;
    rooms.sweep();
    assert.equal(rooms.size, 1, '還在保留期內');
    clock += 31_000;
    rooms.sweep();
    assert.equal(rooms.size, 0);
  });

  test('sweep 會回報超時的房間', () => {
    const rooms = manager();
    const room = rooms.create('A', { ...DEFAULT_ROOM_OPTIONS, timeControl: 'quick' });
    const guest = room.join('B').token;
    room.move(room.token, ...redCannon, 0);
    clock += 400_000;
    assert.deepEqual(rooms.sweep(), [room]);
    assert.equal(guest.length > 0, true);
  });
});
