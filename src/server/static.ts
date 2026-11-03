import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { ServerConfig } from './config';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function contentSecurityPolicy(config: ServerConfig): string {
  const reload = config.devReloadOrigin ? ` ${config.devReloadOrigin}` : '';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' ws: wss:${reload}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

async function resolveFile(
  root: string,
  pathname: string,
): Promise<{ file: string; size: number } | null> {
  const target = path.join(root, path.normalize(pathname));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  try {
    const info = await stat(target);
    return info.isFile() ? { file: target, size: info.size } : null;
  } catch {
    return null;
  }
}

function preferredEncoding(request: IncomingMessage): { name: string; extension: string } | null {
  const accepted = request.headers['accept-encoding'] ?? '';
  const header = Array.isArray(accepted) ? accepted.join(',') : accepted;
  if (header.includes('br')) return { name: 'br', extension: '.br' };
  if (header.includes('gzip')) return { name: 'gzip', extension: '.gz' };
  return null;
}

/** 提供建置好的前端檔案；其他路徑回傳 index.html，交給前端路由處理。 */
export function createStaticHandler(config: ServerConfig) {
  const root = path.resolve(config.clientDir);
  const policy = contentSecurityPolicy(config);

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Content-Security-Policy', policy);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }

    const isAsset = pathname.startsWith('/assets/');
    const direct = pathname === '/' ? null : await resolveFile(root, pathname);
    if (!direct && (isAsset || path.extname(pathname))) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const resolved = direct ?? (await resolveFile(root, '/index.html'));
    if (!resolved) {
      response
        .writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end('尚未建置前端，請先執行 npm run build');
      return;
    }

    const extension = path.extname(resolved.file);
    const encoding = preferredEncoding(request);
    const compressed = encoding
      ? await resolveFile(root, relative(root, resolved.file) + encoding.extension)
      : null;
    response.setHeader('Content-Type', MIME_TYPES[extension] ?? 'application/octet-stream');
    response.setHeader('Vary', 'Accept-Encoding');
    response.setHeader(
      'Cache-Control',
      isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    if (compressed && encoding) response.setHeader('Content-Encoding', encoding.name);
    const served = compressed ?? resolved;
    response.setHeader('Content-Length', served.size);
    response.writeHead(200);

    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(served.file)
      .on('error', () => response.destroy())
      .pipe(response);
  };
}

const relative = (root: string, file: string): string => `/${path.relative(root, file)}`;
