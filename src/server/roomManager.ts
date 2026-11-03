import type { RoomOptions } from '../shared/protocol';
import { RoomError } from './errors';
import { Room, type RoomDeps } from './room';

export interface RoomManagerConfig {
  maxRooms: number;
  /** 房間內沒有任何人之後，保留多久才回收。 */
  idleTtlMs: number;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly config: RoomManagerConfig,
    private readonly deps: RoomDeps,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  create(name: string, options: RoomOptions): Room {
    if (this.rooms.size >= this.config.maxRooms) throw new RoomError('server-busy');
    const room = new Room(this.nextCode(), options, name, this.deps);
    this.rooms.set(room.code, room);
    return room;
  }

  private nextCode(): string {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const code = String(1000 + Math.floor(this.deps.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    for (let value = 1000; value <= 9999; value += 1) {
      if (!this.rooms.has(String(value))) return String(value);
    }
    throw new RoomError('server-busy');
  }

  /** 檢查棋鐘並回收閒置房間，回傳狀態有變化的房間。 */
  sweep(): Room[] {
    const changed: Room[] = [];
    const cutoff = this.deps.now() - this.config.idleTtlMs;
    for (const [code, room] of this.rooms) {
      if (room.tick()) changed.push(room);
      if (!room.hasMembers && room.lastActivity < cutoff) this.rooms.delete(code);
    }
    return changed;
  }
}
