import { z } from 'zod';
import {
  REACTIONS,
  type ReactionId,
  type RoomOptions,
  TIME_CONTROLS,
  type TimeControlId,
} from '../shared/protocol';

/** 用戶端送來的一切都不可信，所有內容都要通過這裡的驗證。 */
const timeControlIds = TIME_CONTROLS.map((item) => item.id) as [TimeControlId, ...TimeControlId[]];
const reactionIds = REACTIONS.map((item) => item.id) as [ReactionId, ...ReactionId[]];

export const playerName = z.string().trim().min(1).max(12);
export const roomCode = z.string().regex(/^\d{4}$/);
const square = z.number().int().min(0).max(89);
const handicap = z.enum(['none', 'horse', 'cannon', 'chariot', 'two-horses', 'chariot-horse']);

export const roomOptionsSchema: z.ZodType<RoomOptions> = z.object({
  timeControl: z.enum(timeControlIds),
  hostColor: z.enum(['red', 'black', 'random']),
  handicap,
  allowHints: z.boolean(),
});

/** 所有請求的型別與參數。每一項都會收到一則對應的回覆。 */
export const requestSchemas = {
  createRoom: z.object({ name: playerName, options: roomOptionsSchema }),
  joinRoom: z.object({ code: roomCode, name: playerName, token: z.string().max(64).optional() }),
  leaveRoom: z.object({}),
  move: z.object({ from: square, to: square, ply: z.number().int().min(0) }),
  resign: z.object({}),
  propose: z.object({ kind: z.enum(['undo', 'draw', 'rematch']) }),
  respond: z.object({ accept: z.boolean() }),
  cancelProposal: z.object({}),
  react: z.object({ reaction: z.enum(reactionIds) }),
} as const;

export const requestEnvelope = z.object({
  id: z.number().int().nonnegative(),
  type: z.string().max(32),
  payload: z.unknown(),
});
