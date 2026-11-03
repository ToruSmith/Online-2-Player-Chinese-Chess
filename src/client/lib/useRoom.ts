import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Game, endGame, playMove, replay } from '../../engine';
import {
  type ProposalKind,
  REACTIONS,
  type ReactionId,
  type RoomView,
  type ServerMessage,
} from '../../shared/protocol';
import { type ConnectionState, RealtimeClient, RequestError } from './realtime';
import { saveSession, sessionToken, forgetSession } from './sessions';
import { playSound } from './sound';

export type RoomFailure = 'not-found' | 'full' | 'replaced' | 'rate-limited';

export interface ReactionBubble {
  from: 'red' | 'black';
  text: string;
  key: number;
}

const toGame = (room: RoomView): Game => {
  const game = replay(room.initialFen, room.moves);
  return room.outcome && !game.outcome ? endGame(game, room.outcome) : game;
};

const failureOf = (error: unknown): RoomFailure | null => {
  if (!(error instanceof RequestError)) return null;
  if (error.code === 'room-not-found') return 'not-found';
  if (error.code === 'room-full') return 'full';
  if (error.code === 'rate-limited') return 'rate-limited';
  return null;
};

/** 管理與一個房間的連線：加入、重連、樂觀更新棋步，以及收發通知。 */
export function useRoom(code: string, name: string) {
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [failure, setFailure] = useState<RoomFailure | null>(null);
  const [optimistic, setOptimistic] = useState<Game | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bubble, setBubble] = useState<ReactionBubble | null>(null);
  const client = useRef<RealtimeClient | null>(null);

  useEffect(() => {
    let bubbleKey = 0;

    const onMessage = (message: ServerMessage) => {
      switch (message.kind) {
        case 'room':
          setRoom(message.room);
          setOptimistic(null);
          break;
        case 'reaction': {
          const text = REACTIONS.find((item) => item.id === message.reaction)?.label ?? '';
          bubbleKey += 1;
          setBubble({ from: message.from, text, key: bubbleKey });
          playSound('notice');
          break;
        }
        case 'declined': {
          const labels: Record<ProposalKind, string> = {
            undo: '對方不同意悔棋。',
            draw: '對方不同意和棋。',
            rematch: '對方不想再來一局。',
          };
          setNotice(labels[message.proposal]);
          break;
        }
        case 'replaced':
          client.current?.halt();
          setFailure('replaced');
          break;
        case 'pulse':
        case 'reply':
          break;
      }
    };

    const realtime = new RealtimeClient({
      onState: setConnection,
      onMessage,
      onOpen: () => {
        realtime
          .request('joinRoom', { code, name, token: sessionToken(code) })
          .then(({ room: joined, token }) => {
            saveSession(code, token);
            setRoom(joined);
            setOptimistic(null);
            setFailure(null);
          })
          .catch((error: unknown) => {
            const reason = failureOf(error);
            if (reason === 'not-found') forgetSession(code);
            if (reason) setFailure(reason);
          });
      },
    });
    client.current = realtime;
    realtime.start();
    return () => {
      realtime.stop();
      client.current = null;
    };
  }, [code, name]);

  const serverGame = useMemo(() => (room ? toGame(room) : null), [room]);
  const game = optimistic ?? serverGame;

  /** 送出請求，失敗時把原因顯示給使用者。 */
  const send = useCallback(async (action: (realtime: RealtimeClient) => Promise<unknown>) => {
    const realtime = client.current;
    if (!realtime) return;
    try {
      await action(realtime);
    } catch (error) {
      setOptimistic(null);
      setNotice(error instanceof Error ? error.message : '操作失敗，請再試一次。');
    }
  }, []);

  const move = useCallback(
    (from: number, to: number) => {
      if (!serverGame) return;
      const next = playMove(serverGame, from, to);
      if (!next) return;
      setOptimistic(next);
      void send((realtime) => realtime.request('move', { from, to, ply: serverGame.moves.length }));
    },
    [send, serverGame],
  );

  const actions = useMemo(
    () => ({
      move,
      propose: (kind: ProposalKind) => send((r) => r.request('propose', { kind })),
      respond: (accept: boolean) => send((r) => r.request('respond', { accept })),
      cancelProposal: () => send((r) => r.request('cancelProposal', {})),
      resign: () => send((r) => r.request('resign', {})),
      react: (reaction: ReactionId) => send((r) => r.request('react', { reaction })),
      leave: () => send((r) => r.request('leaveRoom', {})),
      clearNotice: () => setNotice(null),
    }),
    [move, send],
  );

  return { connection, room, game, failure, notice, bubble, actions };
}
