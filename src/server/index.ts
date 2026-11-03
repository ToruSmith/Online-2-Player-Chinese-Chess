import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = createApp(config);

app.server.listen(config.port, config.host, () => {
  console.log(`親子象棋伺服器已啟動：http://localhost:${config.port}`);
});

function shutdown(signal: string): void {
  console.log(`收到 ${signal}，正在關閉伺服器`);
  app.close().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error('關閉伺服器時發生錯誤', error);
      process.exit(1);
    },
  );
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
