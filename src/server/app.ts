import { randomBytes, randomInt } from 'node:crypto';
import { type Server, createServer } from 'node:http';
import type { ServerConfig } from './config';
import { Gateway } from './gateway';
import type { RoomDeps } from './room';
import { RoomManager } from './roomManager';
import { createStaticHandler } from './static';

export interface App {
  server: Server;
  rooms: RoomManager;
  close: () => Promise<void>;
}

const defaultDeps: RoomDeps = {
  now: Date.now,
  createToken: () => randomBytes(18).toString('base64url'),
  random: () => randomInt(0, 1_000_000) / 1_000_000,
};

export function createApp(config: ServerConfig, deps: RoomDeps = defaultDeps): App {
  const rooms = new RoomManager(
    { maxRooms: config.maxRooms, idleTtlMs: config.roomIdleTtlMs },
    deps,
  );
  const serveStatic = createStaticHandler(config);

  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
      return;
    }
    serveStatic(request, response).catch((error: unknown) => {
      console.error('提供靜態檔案時發生錯誤', error);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });

  const gateway = new Gateway(server, rooms, config);

  return {
    server,
    rooms,
    close: () =>
      new Promise((resolve, reject) => {
        gateway.close();
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
