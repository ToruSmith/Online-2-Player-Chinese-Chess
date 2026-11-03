import { spawn } from 'node:child_process';
import { type ServerResponse, createServer } from 'node:http';
import { CLIENT_DIR, watchClient } from './lib/client-build';

/** 開發模式：前端存檔後自動重建並重新整理，後端由 tsx 監看並重啟。 */
const RELOAD_PORT = Number(process.env.DEV_RELOAD_PORT ?? 3001);
const reloadOrigin = `http://localhost:${RELOAD_PORT}`;
const listeners = new Set<ServerResponse>();

createServer((request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  listeners.add(response);
  request.on('close', () => listeners.delete(response));
})
  .on('error', (error) => console.warn('即時重載無法啟動，需要手動重新整理：', error.message))
  .listen(RELOAD_PORT);

// Google AI Studio 會以 DISABLE_HMR 關閉檔案監看造成的畫面閃爍。
const reloadUrl = process.env.DISABLE_HMR === 'true' ? '' : `${reloadOrigin}/events`;

await watchClient(reloadUrl, () => {
  for (const listener of listeners) listener.write('event: change\ndata: reload\n\n');
});

const server = spawn('npx', ['tsx', 'watch', 'src/server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, CLIENT_DIR, DEV_RELOAD_ORIGIN: reloadOrigin },
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.kill(signal);
    process.exit(0);
  });
}
