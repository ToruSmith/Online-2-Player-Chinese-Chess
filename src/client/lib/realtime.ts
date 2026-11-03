import {
  type ErrorCode,
  ERROR_MESSAGES,
  type RequestPayload,
  type RequestType,
  type ResponseMap,
  type ServerMessage,
} from '../../shared/protocol';

export type ConnectionState = 'connecting' | 'online' | 'offline';

export class RequestError extends Error {
  constructor(readonly code: ErrorCode | 'offline') {
    super(code === 'offline' ? '連線中斷，正在重新連線。' : ERROR_MESSAGES[code]);
    this.name = 'RequestError';
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
}

const REQUEST_TIMEOUT_MS = 8000;
/** 超過這段時間沒收到任何訊息，就視為連線已失效。 */
const SILENCE_LIMIT_MS = 50_000;
const MAX_RETRY_DELAY_MS = 8000;

export interface RealtimeEvents {
  onState: (state: ConnectionState) => void;
  onMessage: (message: ServerMessage) => void;
  /** 每次連上（包含重新連上）時呼叫。 */
  onOpen: () => void;
}

/** 維持一條會自動重連的 WebSocket，並提供請求與回覆的配對。 */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private retries = 0;
  private retryTimer = 0;
  private watchdog = 0;
  private lastHeard = 0;
  private stopped = false;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly events: RealtimeEvents) {}

  private readonly wake = (): void => {
    if (document.visibilityState === 'hidden') return;
    const stale = Date.now() - this.lastHeard > SILENCE_LIMIT_MS;
    if (stale) this.socket?.close();
    if (!this.socket) this.connect();
  };

  start(): void {
    this.stopped = false;
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.wake);
    this.watchdog = window.setInterval(this.wake, 10_000);
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    window.clearInterval(this.watchdog);
    window.clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = null;
    this.rejectAll();
  }

  /** 暫停自動重連，例如同一座位被其他裝置接手時。 */
  halt(): void {
    this.stopped = true;
    window.clearTimeout(this.retryTimer);
    this.socket?.close();
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    window.clearTimeout(this.retryTimer);
    this.events.onState('connecting');
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${window.location.host}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      this.retries = 0;
      this.lastHeard = Date.now();
      this.events.onState('online');
      this.events.onOpen();
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      this.lastHeard = Date.now();
      this.dispatch(JSON.parse(event.data) as ServerMessage);
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.rejectAll();
      if (this.stopped) return;
      this.events.onState('offline');
      const delay = Math.min(MAX_RETRY_DELAY_MS, 500 * 2 ** this.retries);
      this.retries += 1;
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  private dispatch(message: ServerMessage): void {
    if (message.kind !== 'reply') {
      this.events.onMessage(message);
      return;
    }
    const request = this.pending.get(message.id);
    if (!request) return;
    this.pending.delete(message.id);
    window.clearTimeout(request.timer);
    if (message.ok) request.resolve(message.data);
    else request.reject(new RequestError(message.error));
  }

  private rejectAll(): void {
    for (const request of this.pending.values()) {
      window.clearTimeout(request.timer);
      request.reject(new RequestError('offline'));
    }
    this.pending.clear();
  }

  request<T extends RequestType>(type: T, payload: RequestPayload<T>): Promise<ResponseMap[T]> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        reject(new RequestError('offline'));
        return;
      }
      const id = this.nextId++;
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new RequestError('offline'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.socket.send(JSON.stringify({ id, type, payload }));
    });
  }
}
