import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { type BuildOptions, type Metafile, type Plugin, build, context } from 'esbuild';

export const CLIENT_DIR = 'dist/client';
const ASSET_DIR = `${CLIENT_DIR}/assets`;

const shared: BuildOptions = {
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  outdir: ASSET_DIR,
  metafile: true,
  logLevel: 'info',
};

const outputOf = (metafile: Metafile, entry: string): { js: string; css?: string } => {
  const [file, output] = Object.entries(metafile.outputs).find(
    ([, value]) => value.entryPoint === entry,
  )!;
  return { js: toUrl(file), css: output.cssBundle && toUrl(output.cssBundle) };
};

const toUrl = (file: string): string => `/${path.relative(CLIENT_DIR, file)}`;

function writeHtml(js: string, css?: string): void {
  const html = readFileSync('index.html', 'utf8')
    .replace('<!-- app:css -->', css ? `<link rel="stylesheet" href="${css}" />` : '')
    .replace('<!-- app:js -->', `<script type="module" src="${js}"></script>`);
  writeFileSync(`${CLIENT_DIR}/index.html`, html);
}

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? listFiles(file) : [file];
  });
}

function writeServiceWorker(): void {
  const files = listFiles(CLIENT_DIR).filter(
    (file) => !file.endsWith('.map') && !file.endsWith('sw.js'),
  );
  const hash = createHash('sha256');
  for (const file of files) hash.update(readFileSync(file));
  const worker = readFileSync('public/sw.js', 'utf8')
    .replace('__BUILD_ID__', hash.digest('hex').slice(0, 12))
    .replace('__PRECACHE__', JSON.stringify(files.map(toUrl)));
  writeFileSync(`${CLIENT_DIR}/sw.js`, worker);
}

/** 預先壓縮，伺服器就不必在每次請求時重新計算。 */
function precompress(): void {
  for (const file of listFiles(CLIENT_DIR)) {
    if (!/\.(js|css|html|svg|webmanifest)$/.test(file)) continue;
    const content = readFileSync(file);
    writeFileSync(`${file}.gz`, gzipSync(content, { level: 9 }));
    writeFileSync(`${file}.br`, brotliCompressSync(content));
  }
}

function resetOutput(): void {
  rmSync(CLIENT_DIR, { recursive: true, force: true });
  mkdirSync(ASSET_DIR, { recursive: true });
  cpSync('public', CLIENT_DIR, { recursive: true });
}

export async function buildClient(): Promise<void> {
  resetOutput();
  const worker = await build({
    ...shared,
    entryPoints: ['src/client/engineWorker.ts'],
    entryNames: 'engine-[hash]',
    minify: true,
  });
  const main = await build({
    ...shared,
    entryPoints: ['src/client/main.tsx'],
    entryNames: 'app-[hash]',
    minify: true,
    sourcemap: true,
    define: {
      __ENGINE_WORKER_URL__: JSON.stringify(
        outputOf(worker.metafile!, 'src/client/engineWorker.ts').js,
      ),
      __DEV_RELOAD_URL__: '""',
      'process.env.NODE_ENV': '"production"',
    },
  });
  const { js, css } = outputOf(main.metafile!, 'src/client/main.tsx');
  writeHtml(js, css);
  writeServiceWorker();
  precompress();
}

export async function watchClient(reloadUrl: string, onRebuild: () => void): Promise<void> {
  resetOutput();
  const notify: Plugin = {
    name: 'notify-reload',
    setup(pluginBuild) {
      pluginBuild.onEnd((result) => {
        if (result.errors.length === 0) onRebuild();
      });
    },
  };
  const worker = await context({
    ...shared,
    entryPoints: ['src/client/engineWorker.ts'],
    entryNames: 'engine',
    sourcemap: true,
    plugins: [notify],
  });
  const main = await context({
    ...shared,
    entryPoints: ['src/client/main.tsx'],
    entryNames: 'app',
    sourcemap: true,
    define: {
      __ENGINE_WORKER_URL__: '"/assets/engine.js"',
      __DEV_RELOAD_URL__: JSON.stringify(reloadUrl),
      'process.env.NODE_ENV': '"development"',
    },
    plugins: [notify],
  });
  writeHtml('/assets/app.js', '/assets/app.css');
  await Promise.all([worker.watch(), main.watch()]);
}
