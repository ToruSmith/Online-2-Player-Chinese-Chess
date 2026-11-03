import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { WebSocket } from 'ws';
import { toSquare } from '../../src/engine';
import { type App, createApp } from '../../src/server/app';
import { loadConfig } from '../../src/server/config';
import { isOriginAllowed } from '../../src/server/gateway';
import {
  DEFAULT_ROOM_OPTIONS,
  type JoinResult,
  type RoomView,
  type ServerMessage,
} from '../../src/shared/protocol';

let app: App;
let port: number;
let clientDir: string;

/** 測試用的簡易用戶端，收到的訊息會排隊等待檢查。 */
class Client {
  private nextId = 1;
  private readonly inbox: ServerMessage[] = [];
  private readonly waiters: (() => void)[] = [];
  readonly socket: WebSocket;
  closed: Promise<void>;

  constructor(headers: Record<string, string> = {}) {
    this.socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
    this.closed = new Promise((resolve) => this.socket.once('close', () => resolve()));
    this.socket.on('message', (data) => {
      this.inbox.push(JSON.parse(data.toString()) as ServerMessage);
      this.waiters.splice(0).forEach((wake) => wake());
    });
  }

  open(): Promise<this> {
    return new Promise((resolve, reject) => {
      this.socket.once('open', () => resolve(this));
      this.socket.once('error', reject);
    });
  }

  async next<K extends ServerMessage['kind']>(
    match: (message: ServerMessage) => message is Extract<ServerMessage, { kind: K }>,
  ): Promise<Extract<ServerMessage, { kind: K }>> {
    const deadline = Date.now() + 2000;
    for (;;) {
      const index = this.inbox.findIndex(match);
      if (index >= 0) return this.inbox.splice(index, 1)[0] as Extract<ServerMessage, { kind: K }>;
      if (Date.now() > deadline) throw new Error('等待伺服器訊息逾時');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 100);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  async request<T = unknown>(type: string, payload: unknown = {}): Promise<T> {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, type, payload }));
    const reply = await this.next(
      (m): m is Extract<ServerMessage, { kind: 'reply' }> => m.kind === 'reply' && m.id === id,
    );
    if (!reply.ok) throw new Error(reply.error);
    return reply.data as T;
  }

  /** 取得下一則符合條件的房間狀態。 */
  async room(predicate: (room: RoomView) => boolean = () => true): Promise<RoomView> {
    const message = await this.next(
      (m): m is Extract<ServerMessage, { kind: 'room' }> => m.kind === 'room' && predicate(m.room),
    );
    return message.room;
  }

  close(): void {
    this.socket.close();
  }
}

const connect = () => new Client().open();

async function createAndJoin() {
  const host = await connect();
  const guest = await connect();
  const created = await host.request<JoinResult>('createRoom', {
    name: '爸爸',
    options: DEFAULT_ROOM_OPTIONS,
  });
  const joined = await guest.request<JoinResult>('joinRoom', {
    code: created.room.code,
    name: '小明',
  });
  return {
    host,
    guest,
    code: created.room.code,
    hostToken: created.token,
    guestToken: joined.token,
  };
}

before(async () => {
  clientDir = mkdtempSync(path.join(tmpdir(), 'xiangqi-static-'));
  writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html><title>測試</title>');
  writeFileSync(path.join(clientDir, 'hello.txt'), 'hello');
  app = createApp({
    ...loadConfig({}),
    clientDir,
    allowedOrigins: ['https://allowed.example'],
  });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  port = (app.server.address() as AddressInfo).port;
});

after(async () => {
  await app.close();
  rmSync(clientDir, { recursive: true, force: true });
});

describe('線上對戰流程', () => {
  test('雙方連線後能下棋，對手會即時收到', async () => {
    const { host, guest } = await createAndJoin();
    await host.room((room) => room.status === 'playing');
    await host.request('move', { from: toSquare(7, 7), to: toSquare(4, 7), ply: 0 });
    const seen = await guest.room((room) => room.moves.length === 1);
    assert.equal(seen.role, 'black');
    assert.deepEqual(seen.moves[0], [toSquare(7, 7), toSquare(4, 7)]);
    host.close();
    guest.close();
  });

  test('用戶端無法走出不合法的棋', async () => {
    const { host, guest } = await createAndJoin();
    await assert.rejects(
      host.request('move', { from: toSquare(0, 9), to: toSquare(0, 2), ply: 0 }),
      /illegal-move/,
    );
    await assert.rejects(
      guest.request('move', { from: toSquare(0, 0), to: toSquare(0, 1), ply: 0 }),
      /not-your-turn/,
    );
    host.close();
    guest.close();
  });

  test('斷線重連後回到原本的座位與棋局', async () => {
    const { host, guest, code, guestToken } = await createAndJoin();
    await host.request('move', { from: toSquare(7, 7), to: toSquare(4, 7), ply: 0 });
    guest.close();
    await guest.closed;
    await host.room((room) => room.seats.black?.connected === false);

    const stranger = await connect();
    const peek = await stranger.request<JoinResult>('joinRoom', { code, name: '路人' });
    assert.equal(peek.room.role, 'spectator');

    const back = await connect();
    const result = await back.request<JoinResult>('joinRoom', {
      code,
      name: '小明',
      token: guestToken,
    });
    assert.equal(result.room.role, 'black');
    assert.equal(result.room.moves.length, 1);
    await host.room((room) => room.seats.black?.connected === true);

    host.close();
    back.close();
    stranger.close();
  });

  test('同一座位從新裝置登入時，舊連線會被取代', async () => {
    const { host, guest, code, guestToken } = await createAndJoin();
    const second = await connect();
    await second.request('joinRoom', { code, name: '小明', token: guestToken });
    await guest.next(
      (m): m is Extract<ServerMessage, { kind: 'replaced' }> => m.kind === 'replaced',
    );
    await guest.closed;
    const view = await host.room((room) => room.seats.black?.connected === true);
    assert.equal(view.seats.black?.name, '小明');
    host.close();
    second.close();
  });

  test('悔棋被拒絕時，提出的一方會收到通知', async () => {
    const { host, guest } = await createAndJoin();
    await host.request('move', { from: toSquare(7, 7), to: toSquare(4, 7), ply: 0 });
    await host.request('propose', { kind: 'undo' });
    await guest.room((room) => room.proposal?.kind === 'undo');
    await guest.request('respond', { accept: false });
    const declined = await host.next(
      (m): m is Extract<ServerMessage, { kind: 'declined' }> => m.kind === 'declined',
    );
    assert.equal(declined.proposal, 'undo');
    host.close();
    guest.close();
  });

  test('表情反應會傳給雙方，觀戰者不能送出', async () => {
    const { host, guest, code } = await createAndJoin();
    const viewer = await connect();
    await viewer.request('joinRoom', { code, name: '阿姨' });
    await host.request('react', { reaction: 'nice' });
    const message = await guest.next(
      (m): m is Extract<ServerMessage, { kind: 'reaction' }> => m.kind === 'reaction',
    );
    assert.deepEqual([message.from, message.reaction], ['red', 'nice']);
    await assert.rejects(viewer.request('react', { reaction: 'nice' }), /not-a-player/);
    host.close();
    guest.close();
    viewer.close();
  });

  test('離開房間後對手會看到離線', async () => {
    const { host, guest } = await createAndJoin();
    await guest.request('leaveRoom');
    await host.room((room) => room.seats.black?.connected === false);
    await assert.rejects(host.request('nothing'), /bad-request/);
    host.close();
    guest.close();
  });
});

describe('輸入防護', () => {
  test('格式錯誤的請求會被拒絕，連線不受影響', async () => {
    const client = await connect();
    client.socket.send('not json');
    client.socket.send(JSON.stringify({ id: 'x' }));
    await assert.rejects(client.request('toString'), /bad-request/);
    await assert.rejects(client.request('__proto__'), /bad-request/);
    await assert.rejects(client.request('createRoom', { name: '', options: {} }), /bad-request/);
    await assert.rejects(client.request('joinRoom', { code: '12', name: 'x' }), /bad-request/);
    await assert.rejects(client.request('move', { from: 999, to: 0, ply: 0 }), /bad-request/);
    await assert.rejects(client.request('move', { from: 1, to: 2, ply: 0 }), /not-in-room/);
    client.close();
  });

  test('過大的訊息會中斷連線', async () => {
    const client = await connect();
    client.socket.on('error', () => undefined);
    client.socket.send('x'.repeat(4096));
    await client.closed;
  });

  test('短時間大量請求會被限流', async () => {
    const client = await connect();
    const results = await Promise.allSettled(
      Array.from({ length: 60 }, () => client.request('move', { from: 1, to: 2, ply: 0 })),
    );
    const limited = results.filter(
      (r) => r.status === 'rejected' && /rate-limited/.test(String(r.reason)),
    );
    assert.ok(limited.length > 0);
    client.close();
  });

  test('連續嘗試房號會被限流', async () => {
    const client = new Client({});
    await client.open();
    const errors: string[] = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await client
        .request('joinRoom', { code: '0000', name: '掃描' })
        .catch((error: Error) => errors.push(error.message));
    }
    assert.ok(errors.includes('rate-limited'));
    client.close();
  });
});

describe('連線來源檢查', () => {
  test('只接受同站或白名單來源', () => {
    assert.equal(isOriginAllowed(undefined, 'a.example', []), true);
    assert.equal(isOriginAllowed('https://a.example', 'a.example', []), true);
    assert.equal(isOriginAllowed('https://evil.example', 'a.example', []), false);
    assert.equal(isOriginAllowed('https://b.example', 'a.example', ['https://b.example']), true);
    assert.equal(isOriginAllowed('not a url', 'a.example', []), false);
  });

  test('跨站 WebSocket 連線會被擋下', async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { Origin: 'https://evil.example' },
    });
    const status = await new Promise<number>((resolve) => {
      socket.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
      socket.once('error', () => resolve(-1));
    });
    assert.ok(status === 403 || status === -1);
  });
});

describe('HTTP', () => {
  const url = (pathname: string) => `http://127.0.0.1:${port}${pathname}`;

  test('健康檢查', async () => {
    const response = await fetch(url('/healthz'));
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as { status: string }).status, 'ok');
  });

  test('前端路由回傳 index.html，並帶有安全標頭', async () => {
    const response = await fetch(url('/room/1234'));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>測試/);
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  });

  test('找不到的資源回傳 404，不會回 index.html', async () => {
    assert.equal((await fetch(url('/assets/missing.js'))).status, 404);
    assert.equal((await fetch(url('/nope.png'))).status, 404);
  });

  test('無法用路徑穿越讀取目錄外的檔案', async () => {
    const encoded = await fetch(url('/..%2f..%2f..%2fetc%2fpasswd'));
    assert.ok(![200].includes(encoded.status) || !(await encoded.text()).includes('root:'));
  });

  test('只接受 GET 與 HEAD', async () => {
    assert.equal((await fetch(url('/'), { method: 'POST' })).status, 405);
    assert.equal((await fetch(url('/hello.txt'), { method: 'HEAD' })).status, 200);
  });
});
