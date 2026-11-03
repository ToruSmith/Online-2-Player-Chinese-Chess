import type { Color, EndReason, HandicapKind } from '../engine';

/** 用戶端與伺服器共用的常數與型別。伺服器端的輸入驗證在 src/server/schemas.ts。 */

export const TIME_CONTROLS = [
  { id: 'none', label: '不限時', baseMs: 0, incrementMs: 0 },
  { id: 'quick', label: '每方 5 分鐘，每步加 3 秒', baseMs: 5 * 60_000, incrementMs: 3_000 },
  { id: 'standard', label: '每方 10 分鐘，每步加 5 秒', baseMs: 10 * 60_000, incrementMs: 5_000 },
  { id: 'relaxed', label: '每方 20 分鐘，每步加 10 秒', baseMs: 20 * 60_000, incrementMs: 10_000 },
] as const;
export type TimeControlId = (typeof TIME_CONTROLS)[number]['id'];

export const REACTIONS = [
  { id: 'nice', label: '好棋！' },
  { id: 'cheer', label: '加油！' },
  { id: 'think', label: '讓我想想' },
  { id: 'wow', label: '哇！' },
  { id: 'again', label: '再來一局' },
  { id: 'hug', label: '抱一個' },
] as const;
export type ReactionId = (typeof REACTIONS)[number]['id'];

export type ProposalKind = 'undo' | 'draw' | 'rematch';

export interface RoomOptions {
  timeControl: TimeControlId;
  hostColor: Color | 'random';
  handicap: HandicapKind;
  allowHints: boolean;
}

export const DEFAULT_ROOM_OPTIONS: RoomOptions = {
  timeControl: 'none',
  hostColor: 'red',
  handicap: 'none',
  allowHints: true,
};

export type Role = Color | 'spectator';

export interface SeatView {
  name: string;
  connected: boolean;
}

export interface ClockView {
  red: number;
  black: number;
  /** 正在計時的一方；暫停時為 null。 */
  running: Color | null;
}

export interface ProposalView {
  kind: ProposalKind;
  from: Color;
}

export interface RoomView {
  code: string;
  role: Role;
  status: 'waiting' | 'playing' | 'finished';
  seats: Record<Color, SeatView | null>;
  spectators: number;
  options: RoomOptions;
  initialFen: string;
  moves: [number, number][];
  outcome: { winner: Color | null; reason: EndReason } | null;
  proposal: ProposalView | null;
  clock: ClockView | null;
  /** 第幾盤，重賽時會加一。 */
  round: number;
}

/** 用戶端可以送出的請求與參數。 */
export interface RequestMap {
  createRoom: { name: string; options: RoomOptions };
  joinRoom: { code: string; name: string; token?: string };
  leaveRoom: Record<string, never>;
  move: { from: number; to: number; ply: number };
  resign: Record<string, never>;
  propose: { kind: ProposalKind };
  respond: { accept: boolean };
  cancelProposal: Record<string, never>;
  react: { reaction: ReactionId };
}

export type RequestType = keyof RequestMap;
export type RequestPayload<T extends RequestType> = RequestMap[T];

export interface JoinResult {
  room: RoomView;
  token: string;
}

export interface ResponseMap {
  createRoom: JoinResult;
  joinRoom: JoinResult;
  leaveRoom: null;
  move: null;
  resign: null;
  propose: null;
  respond: null;
  cancelProposal: null;
  react: null;
}

export type ServerMessage =
  | { kind: 'reply'; id: number; ok: true; data: unknown }
  | { kind: 'reply'; id: number; ok: false; error: ErrorCode }
  | { kind: 'room'; room: RoomView }
  | { kind: 'reaction'; from: Color; reaction: ReactionId }
  | { kind: 'declined'; proposal: ProposalKind }
  | { kind: 'replaced' }
  | { kind: 'pulse' };

export const ERROR_MESSAGES = {
  'bad-request': '這個操作的內容有誤，請重新整理頁面後再試。',
  'rate-limited': '操作太頻繁了，請稍等一下。',
  'server-busy': '目前房間數量已滿，請稍後再建立。',
  'room-not-found': '找不到這個房間，請確認房間代碼。',
  'room-full': '這個房間的觀戰人數已滿。',
  'not-in-room': '你已經不在這個房間了，請重新加入。',
  'not-a-player': '觀戰時不能進行這個操作。',
  'not-your-turn': '還沒輪到你。',
  'stale-position': '棋盤已經更新，請再走一次。',
  'illegal-move': '這一步不符合規則。',
  'game-not-active': '目前無法進行這個操作。',
  'nothing-to-undo': '目前沒有可以悔的棋。',
  'proposal-pending': '還有一個請求正在等待回覆。',
  'no-proposal': '這個請求已經失效了。',
} as const;
export type ErrorCode = keyof typeof ERROR_MESSAGES;
