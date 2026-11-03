import type { ErrorCode } from '../shared/protocol';

/** 可以直接回覆給用戶端的錯誤。 */
export class RoomError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = 'RoomError';
  }
}
