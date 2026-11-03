import {
  type Color,
  type Game,
  createGame,
  endGame,
  handicapFen,
  opposite,
  playMove,
  takeBack,
} from '../engine';
import {
  type ProposalKind,
  type ProposalView,
  type Role,
  type RoomOptions,
  type RoomView,
  TIME_CONTROLS,
} from '../shared/protocol';
import { RoomError } from './errors';

export interface RoomDeps {
  now: () => number;
  createToken: () => string;
  random: () => number;
}

interface Player {
  token: string;
  name: string;
  connected: boolean;
}

interface Clock {
  red: number;
  black: number;
  /** 目前這段計時的起點；暫停時為 null。 */
  runningSince: number | null;
}

export const MAX_SPECTATORS = 8;

/**
 * 一個對局房間。這裡是連線對戰唯一的狀態來源：
 * 用戶端只送出意圖，棋步合法性、回合、棋鐘全部由伺服器判定。
 * 這個類別不碰網路，所以可以用假時鐘直接測試。
 */
export class Room {
  private readonly seats: Record<Color, Player | null> = { red: null, black: null };
  private readonly hostToken: string;
  private game: Game;
  private clock: Clock | null;
  private proposal: ProposalView | null = null;
  private round = 1;
  private spectators = 0;
  private lastActiveAt: number;

  constructor(
    readonly code: string,
    readonly options: RoomOptions,
    hostName: string,
    private readonly deps: RoomDeps,
  ) {
    const hostColor =
      options.hostColor === 'random' ? (deps.random() < 0.5 ? 'red' : 'black') : options.hostColor;
    this.hostToken = deps.createToken();
    this.seats[hostColor] = { token: this.hostToken, name: hostName, connected: true };
    this.game = this.newGame(hostColor);
    this.clock = this.newClock();
    this.lastActiveAt = deps.now();
  }

  get token(): string {
    return this.hostToken;
  }

  get lastActivity(): number {
    return this.lastActiveAt;
  }

  private newGame(hostColor: Color): Game {
    return createGame(handicapFen(hostColor, this.options.handicap));
  }

  private newClock(): Clock | null {
    const control = TIME_CONTROLS.find((item) => item.id === this.options.timeControl);
    if (!control || control.baseMs === 0) return null;
    return { red: control.baseMs, black: control.baseMs, runningSince: null };
  }

  private touch(): void {
    this.lastActiveAt = this.deps.now();
  }

  get status(): RoomView['status'] {
    if (!this.seats.red || !this.seats.black) return 'waiting';
    return this.game.outcome ? 'finished' : 'playing';
  }

  roleOf(token: string): Role {
    if (this.seats.red?.token === token) return 'red';
    if (this.seats.black?.token === token) return 'black';
    return 'spectator';
  }

  private requirePlayer(token: string): Color {
    const role = this.roleOf(token);
    if (role === 'spectator') throw new RoomError('not-a-player');
    return role;
  }

  /** 空位優先；帶著原本的 token 回來時會回到自己的座位。 */
  join(name: string, token?: string): { role: Role; token: string } {
    this.touch();
    if (token) {
      const role = this.roleOf(token);
      if (role !== 'spectator') {
        this.setConnected(token, true);
        return { role, token };
      }
    }
    const openSeat = !this.seats.red ? 'red' : !this.seats.black ? 'black' : null;
    if (openSeat) {
      const seatToken = this.deps.createToken();
      this.seats[openSeat] = { token: seatToken, name, connected: true };
      return { role: openSeat, token: seatToken };
    }
    if (this.spectators >= MAX_SPECTATORS) throw new RoomError('room-full');
    this.spectators += 1;
    return { role: 'spectator', token: this.deps.createToken() };
  }

  /** 玩家離線時保留座位，棋鐘同步暫停。 */
  setConnected(token: string, connected: boolean): void {
    const role = this.roleOf(token);
    if (role === 'spectator') return;
    const seat = this.seats[role]!;
    if (seat.connected === connected) return;
    this.settleClock();
    seat.connected = connected;
    this.resumeClock();
    this.touch();
  }

  removeSpectator(): void {
    this.spectators = Math.max(0, this.spectators - 1);
    this.touch();
  }

  get hasConnectedPlayer(): boolean {
    return Boolean(this.seats.red?.connected || this.seats.black?.connected);
  }

  get hasMembers(): boolean {
    return this.hasConnectedPlayer || this.spectators > 0;
  }

  move(token: string, from: number, to: number, ply: number): void {
    const color = this.requirePlayer(token);
    if (this.status !== 'playing') throw new RoomError('game-not-active');
    if (this.game.turn !== color) throw new RoomError('not-your-turn');
    if (ply !== this.game.moves.length) throw new RoomError('stale-position');
    const next = playMove(this.game, from, to);
    if (!next) throw new RoomError('illegal-move');

    this.settleClock();
    if (this.clock && this.game.moves.length > 0) {
      this.clock[color] += this.incrementMs();
    }
    this.game = next;
    this.proposal = null;
    this.resumeClock();
    this.touch();
  }

  private incrementMs(): number {
    const control = TIME_CONTROLS.find((item) => item.id === this.options.timeControl);
    return control?.incrementMs ?? 0;
  }

  resign(token: string): void {
    const color = this.requirePlayer(token);
    if (this.status !== 'playing') throw new RoomError('game-not-active');
    this.finish({ winner: opposite(color), reason: 'resign' });
  }

  private finish(outcome: NonNullable<Game['outcome']>): void {
    this.settleClock();
    this.game = endGame(this.game, outcome);
    this.proposal = null;
    this.touch();
  }

  /** 悔棋會退回到提出者上一次走棋之前。 */
  private undoPlies(color: Color): number {
    return this.game.turn === color ? 2 : 1;
  }

  propose(token: string, kind: ProposalKind): void {
    const color = this.requirePlayer(token);
    if (this.proposal) throw new RoomError('proposal-pending');
    if (this.status === 'waiting') throw new RoomError('game-not-active');

    if (kind === 'draw' && this.status !== 'playing') throw new RoomError('game-not-active');
    if (kind === 'rematch' && this.status !== 'finished') throw new RoomError('game-not-active');
    if (kind === 'undo') {
      const reason = this.game.outcome?.reason;
      if (reason === 'resign' || reason === 'timeout' || reason === 'agreement') {
        throw new RoomError('game-not-active');
      }
      if (this.game.moves.length < this.undoPlies(color)) throw new RoomError('nothing-to-undo');
    }
    this.proposal = { kind, from: color };
    this.touch();
  }

  cancelProposal(token: string): void {
    const color = this.requirePlayer(token);
    if (this.proposal?.from !== color) throw new RoomError('no-proposal');
    this.proposal = null;
    this.touch();
  }

  /** 回覆對方的請求，並回傳被回覆的種類。 */
  respond(token: string, accept: boolean): ProposalKind {
    const color = this.requirePlayer(token);
    const proposal = this.proposal;
    if (!proposal || proposal.from === color) throw new RoomError('no-proposal');
    this.proposal = null;
    this.touch();
    if (!accept) return proposal.kind;

    if (proposal.kind === 'draw') this.finish({ winner: null, reason: 'agreement' });
    if (proposal.kind === 'undo') this.applyUndo(proposal.from);
    if (proposal.kind === 'rematch') this.startRematch();
    return proposal.kind;
  }

  private applyUndo(requester: Color): void {
    this.settleClock();
    this.game = takeBack(this.game, this.undoPlies(requester));
    this.resumeClock();
  }

  private startRematch(): void {
    const { red, black } = this.seats;
    this.seats.red = black;
    this.seats.black = red;
    const hostColor = this.roleOf(this.hostToken) as Color;
    this.game = this.newGame(hostColor);
    this.clock = this.newClock();
    this.round += 1;
    this.resumeClock();
  }

  private remaining(color: Color): number {
    const clock = this.clock;
    if (!clock) return 0;
    const elapsed =
      clock.runningSince !== null && this.game.turn === color
        ? this.deps.now() - clock.runningSince
        : 0;
    return Math.max(0, clock[color] - elapsed);
  }

  private settleClock(): void {
    const clock = this.clock;
    if (!clock || clock.runningSince === null) return;
    clock[this.game.turn] = this.remaining(this.game.turn);
    clock.runningSince = null;
  }

  /** 第一步不計時，雙方都在線上時才走鐘。 */
  private resumeClock(): void {
    const clock = this.clock;
    if (!clock) return;
    const bothOnline = this.seats.red?.connected && this.seats.black?.connected;
    const shouldRun = this.status === 'playing' && this.game.moves.length > 0 && bothOnline;
    clock.runningSince = shouldRun ? this.deps.now() : null;
  }

  /** 檢查是否超時。回傳 true 代表房間狀態有變。 */
  tick(): boolean {
    if (this.clock?.runningSince === null || !this.clock) return false;
    const turn = this.game.turn;
    if (this.remaining(turn) > 0) return false;
    this.finish({ winner: opposite(turn), reason: 'timeout' });
    this.clock[turn] = 0;
    return true;
  }

  view(role: Role): RoomView {
    const seatView = (color: Color) => {
      const seat = this.seats[color];
      return seat ? { name: seat.name, connected: seat.connected } : null;
    };
    const clock = this.clock
      ? {
          red: this.remaining('red'),
          black: this.remaining('black'),
          running: this.clock.runningSince !== null ? this.game.turn : null,
        }
      : null;
    return {
      code: this.code,
      role,
      status: this.status,
      seats: { red: seatView('red'), black: seatView('black') },
      spectators: this.spectators,
      options: this.options,
      initialFen: this.game.initialFen,
      moves: this.game.moves.map((move) => [move.from, move.to]),
      outcome: this.game.outcome,
      proposal: this.proposal,
      clock,
      round: this.round,
    };
  }
}
