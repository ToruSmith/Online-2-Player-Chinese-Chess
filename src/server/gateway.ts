import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { Color } from '../engine';
import {
  type ErrorCode,
  type JoinResult,
  type Role,
  type RequestPayload,
  type RequestType,
  type ServerMessage,
} from '../shared/protocol';
import type { ServerConfig } from './config';
import { RoomError } from './errors';
import { TokenBucket } from './rateLimiter';
import type { Room } from './room';
import type { RoomManager } from './roomManager';
import { requestEnvelope, requestSchemas } from './schemas';

const MAX_MESSAGE_BYTES = 2048;
const HEARTBEAT_MS = 20_000;

interface Connection {
  socket: WebSocket;
  address: string;
  alive: boolean;
  room: Room | null;
  token: string | null;
  role: Role | null;
  messages: TokenBucket;
  reactions: TokenBucket;
}

type Handler<T extends RequestType> = (
  connection: Connection,
  payload: RequestPayload<T>,
) => unknown;

export function isOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
  allowed: readonly string[],
): boolean {
  // 非瀏覽器用戶端不會帶 Origin，也不受跨站 WebSocket 劫持影響。
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export class Gateway {
  private readonly server: WebSocketServer;
  private readonly connections = new Set<Connection>();
  private readonly addressBuckets = new Map<string, TokenBucket>();
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    httpServer: Server,
    private readonly rooms: RoomManager,
    private readonly config: ServerConfig,
  ) {
    this.server = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
    httpServer.on('upgrade', (request, socket, head) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      const allowed = isOriginAllowed(
        request.headers.origin,
        request.headers.host,
        config.allowedOrigins,
      );
      if (path !== '/ws' || !allowed) {
        socket.write(`HTTP/1.1 ${allowed ? 404 : 403} Rejected\r\n\r\n`);
        socket.destroy();
        return;
      }
      this.server.handleUpgrade(request, socket, head, (client) => this.accept(client, request));
    });
    this.timers.push(
      setInterval(() => this.heartbeat(), HEARTBEAT_MS),
      setInterval(() => this.sweep(), 500),
    );
  }

  private addressOf(request: IncomingMessage): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (this.config.trustProxy && typeof forwarded === 'string') {
      // 最右邊是可信代理親眼看到的位址；左邊的內容可以由用戶端偽造。
      return forwarded.split(',').at(-1)!.trim();
    }
    return request.socket.remoteAddress ?? 'unknown';
  }

  private accept(socket: WebSocket, request: IncomingMessage): void {
    const connection: Connection = {
      socket,
      address: this.addressOf(request),
      alive: true,
      room: null,
      token: null,
      role: null,
      messages: new TokenBucket(30, 10),
      reactions: new TokenBucket(3, 0.5),
    };
    this.connections.add(connection);
    socket.on('pong', () => {
      connection.alive = true;
    });
    socket.on('message', (data, isBinary) => {
      if (!isBinary) this.onMessage(connection, data.toString());
    });
    socket.on('close', () => this.onClose(connection));
    socket.on('error', () => socket.terminate());
  }

  private send(connection: Connection, message: ServerMessage): void {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(JSON.stringify(message));
    }
  }

  private fail(connection: Connection, id: number, error: ErrorCode): void {
    this.send(connection, { kind: 'reply', id, ok: false, error });
  }

  private onMessage(connection: Connection, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const envelope = requestEnvelope.safeParse(parsed);
    if (!envelope.success) return;
    const { id, type, payload } = envelope.data;

    if (!connection.messages.take()) {
      this.fail(connection, id, 'rate-limited');
      return;
    }
    if (!Object.hasOwn(requestSchemas, type)) {
      this.fail(connection, id, 'bad-request');
      return;
    }
    const requestType = type as RequestType;
    const validated = requestSchemas[requestType].safeParse(payload);
    if (!validated.success) {
      this.fail(connection, id, 'bad-request');
      return;
    }

    try {
      const handler = this.handlers[requestType] as Handler<RequestType>;
      const data = handler(connection, validated.data as RequestPayload<RequestType>) ?? null;
      this.send(connection, { kind: 'reply', id, ok: true, data });
    } catch (error) {
      if (error instanceof RoomError) {
        this.fail(connection, id, error.code);
      } else {
        console.error('處理請求時發生未預期的錯誤', { type, error });
        this.fail(connection, id, 'bad-request');
      }
    }
  }

  private consumeJoinAttempt(address: string): void {
    let bucket = this.addressBuckets.get(address);
    if (!bucket) {
      bucket = new TokenBucket(20, 0.2);
      this.addressBuckets.set(address, bucket);
    }
    if (!bucket.take()) throw new RoomError('rate-limited');
  }

  private requireRoom(connection: Connection): { room: Room; token: string } {
    if (!connection.room || !connection.token) throw new RoomError('not-in-room');
    return { room: connection.room, token: connection.token };
  }

  /** 對房間做一次操作，成功後把最新狀態廣播給所有人。 */
  private act(connection: Connection, action: (room: Room, token: string) => void): void {
    const { room, token } = this.requireRoom(connection);
    action(room, token);
    this.broadcast(room);
  }

  private readonly handlers: { [T in RequestType]: Handler<T> } = {
    createRoom: (connection, { name, options }): JoinResult => {
      this.consumeJoinAttempt(connection.address);
      this.detach(connection);
      const room = this.rooms.create(name, options);
      return this.attach(connection, room, room.token);
    },

    joinRoom: (connection, { code, name, token }): JoinResult => {
      this.consumeJoinAttempt(connection.address);
      const room = this.rooms.get(code);
      if (!room) throw new RoomError('room-not-found');
      this.detach(connection);
      const seat = room.join(name, token);
      this.replaceOlderConnection(connection, seat.token);
      const result = this.attach(connection, room, seat.token);
      this.broadcast(room);
      return result;
    },

    leaveRoom: (connection) => {
      this.detach(connection);
    },

    move: (connection, { from, to, ply }) =>
      this.act(connection, (room, token) => room.move(token, from, to, ply)),

    resign: (connection) => this.act(connection, (room, token) => room.resign(token)),

    propose: (connection, { kind }) =>
      this.act(connection, (room, token) => room.propose(token, kind)),

    cancelProposal: (connection) =>
      this.act(connection, (room, token) => room.cancelProposal(token)),

    respond: (connection, { accept }) =>
      this.act(connection, (room, token) => {
        const kind = room.respond(token, accept);
        if (accept) return;
        for (const peer of this.membersOf(room)) {
          if (peer !== connection && peer.role !== 'spectator') {
            this.send(peer, { kind: 'declined', proposal: kind });
          }
        }
      }),

    react: (connection, { reaction }) => {
      const { room, token } = this.requireRoom(connection);
      const from = room.roleOf(token);
      if (from === 'spectator') throw new RoomError('not-a-player');
      if (!connection.reactions.take()) throw new RoomError('rate-limited');
      for (const peer of this.membersOf(room)) {
        this.send(peer, { kind: 'reaction', from: from as Color, reaction });
      }
    },
  };

  private attach(connection: Connection, room: Room, token: string): JoinResult {
    connection.room = room;
    connection.token = token;
    connection.role = room.roleOf(token);
    return { room: room.view(connection.role), token };
  }

  /** 同一個座位只保留最新的連線（例如重新整理或換裝置）。 */
  private replaceOlderConnection(connection: Connection, token: string): void {
    for (const other of this.connections) {
      if (other !== connection && other.token === token) {
        other.room = null;
        other.token = null;
        other.role = null;
        this.send(other, { kind: 'replaced' });
        other.socket.close();
      }
    }
  }

  private detach(connection: Connection): void {
    const { room, token, role } = connection;
    if (!room || !token) return;
    connection.room = null;
    connection.token = null;
    connection.role = null;
    if (role === 'spectator') room.removeSpectator();
    else room.setConnected(token, false);
    this.broadcast(room);
  }

  private onClose(connection: Connection): void {
    this.detach(connection);
    this.connections.delete(connection);
  }

  private membersOf(room: Room): Connection[] {
    return [...this.connections].filter((connection) => connection.room === room);
  }

  /** 角色可能因重賽換邊，所以每次廣播都重新計算。 */
  private broadcast(room: Room): void {
    for (const member of this.membersOf(room)) {
      member.role = room.roleOf(member.token!);
      this.send(member, { kind: 'room', room: room.view(member.role) });
    }
  }

  private heartbeat(): void {
    for (const connection of this.connections) {
      if (!connection.alive) {
        connection.socket.terminate();
        continue;
      }
      connection.alive = false;
      connection.socket.ping();
      this.send(connection, { kind: 'pulse' });
    }
    for (const [address, bucket] of this.addressBuckets) {
      if (bucket.isFull) this.addressBuckets.delete(address);
    }
  }

  private sweep(): void {
    for (const room of this.rooms.sweep()) this.broadcast(room);
  }

  close(): void {
    this.timers.forEach(clearInterval);
    for (const connection of this.connections) connection.socket.terminate();
    this.server.close();
  }
}
