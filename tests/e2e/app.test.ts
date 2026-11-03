import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { after, before, describe, test } from 'node:test';
import { type Browser, type BrowserContext, type Page, chromium, devices } from 'playwright';
import { PUZZLES, createGame, legalMovesOf, moveFrom, moveTo, playMove } from '../../src/engine';
import { toughestDefense, winningMoves } from '../../src/engine/ai/solver';

/** 需要先執行 npm run build。測試會啟動正式版伺服器，並用真實瀏覽器操作。 */
const PORT = 3457;
const BASE = `http://127.0.0.1:${PORT}`;

let server: ChildProcess;
let browser: Browser;
const pageErrors: string[] = [];

async function open(path: string, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({ baseURL: BASE, ...options });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(`${path}: ${error.message}`));
  await page.goto(path);
  return { context, page };
}

const square = (x: number, y: number) => y * 9 + x;
const cell = (page: Page, target: number) => page.locator(`[data-square="${target}"]`);

async function move(page: Page, from: number, to: number): Promise<void> {
  await cell(page, from).click();
  await cell(page, to).click();
}

const logHas = (page: Page, notation: string) =>
  page.locator('.log').getByText(notation, { exact: true }).waitFor();

async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/online');
  await page.getByPlaceholder('例如：爸爸、小明').fill(name);
  await page.getByRole('button', { name: '建立房間' }).click();
  await page.waitForURL(/\/room\/\d{4}$/);
  return page.url().slice(-4);
}

async function joinRoom(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/online');
  await page.getByPlaceholder('例如：爸爸、小明').fill(name);
  await page.getByLabel('房間代碼').fill(code);
  await page.getByRole('button', { name: '加入房間' }).click();
  await page.waitForURL(`**/room/${code}`);
}

async function startOnlineGame() {
  const host = await open('/');
  const guest = await open('/');
  const code = await createRoom(host.page, '爸爸');
  await joinRoom(guest.page, '小明', code);
  await host.page.getByText('小明').waitFor();
  await guest.page.getByText('爸爸').waitFor();
  return { host, guest, code };
}

const closeAll = async (...contexts: BrowserContext[]) => {
  await Promise.all(contexts.map((context) => context.close()));
};

before(async () => {
  server = spawn('node', ['dist/server/index.js'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    server.stdout?.once('data', () => resolve());
    server.once('exit', () => reject(new Error('伺服器未能啟動，請先執行 npm run build')));
  });
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
  assert.deepEqual(pageErrors, [], '頁面不應出現未處理的錯誤');
});

describe('線上對戰', () => {
  test('兩人下棋、重新整理、悔棋協商、認輸、重賽與觀戰', async () => {
    const { host, guest, code } = await startOnlineGame();

    // 雙方都能走棋，黑方看到的棋盤是翻轉的。
    await move(host.page, square(7, 7), square(4, 7));
    await logHas(guest.page, '炮二平五');
    const blackBox = await cell(guest.page, square(4, 0)).boundingBox();
    const redBox = await cell(guest.page, square(4, 9)).boundingBox();
    assert.ok(blackBox!.y > redBox!.y, '黑方的將應該顯示在下方');

    // 沒輪到時點棋不會有反應。
    await cell(host.page, square(0, 6)).click();
    assert.equal(await host.page.locator('.piece--selected').count(), 0);

    // 重新整理後回到同一個座位，棋局還在。
    await guest.page.reload();
    await logHas(guest.page, '炮二平五');
    await guest.page.getByRole('button', { name: '認輸' }).waitFor();

    // 黑方走棋後，紅方提出悔棋。第一次被拒絕，第二次同意。
    await move(guest.page, square(7, 0), square(6, 2));
    await logHas(host.page, '馬8進7');
    await host.page.getByRole('button', { name: '悔棋' }).click();
    await guest.page.getByText('爸爸想要悔棋').waitFor();
    await guest.page.getByRole('button', { name: '不要' }).click();
    await host.page.getByText('對方不同意悔棋。').waitFor();

    await host.page.getByRole('button', { name: '悔棋' }).click();
    await guest.page.getByRole('button', { name: '好', exact: true }).click();
    await host.page.locator('.log__empty').waitFor();

    const plies: [Page, number, number, string][] = [
      [host.page, square(2, 6), square(2, 5), '兵七進一'],
      [guest.page, square(0, 3), square(0, 4), '卒1進1'],
    ];
    for (const [page, from, to, notation] of plies) {
      await move(page, from, to);
      await logHas(host.page, notation);
    }

    // 快速反應會出現在雙方畫面。
    await host.page.getByRole('button', { name: '加油！' }).click();
    await guest.page.locator('.plate__bubble').getByText('加油！').waitFor();

    // 認輸後兩邊都看到結果，並可以換邊重賽。
    await guest.page.getByRole('button', { name: '認輸' }).click();
    await guest.page.getByRole('dialog').getByRole('button', { name: '認輸' }).click();
    await host.page.getByRole('heading', { name: '你贏了' }).waitFor();
    await guest.page.getByRole('heading', { name: '這盤輸了' }).waitFor();

    const resultDialog = guest.page.getByRole('dialog');
    assert.equal(await resultDialog.getByRole('button', { name: '悔棋' }).count(), 0);
    await resultDialog.getByRole('button', { name: /再來一局/ }).click();
    await host.page.getByText('小明想再來一局').waitFor();
    await host.page.getByRole('button', { name: '好', exact: true }).click();
    await guest.page.locator('.log__empty').waitFor();

    // 換邊：原本執黑的小明現在先走。
    await move(guest.page, square(7, 7), square(4, 7));
    await logHas(host.page, '炮二平五');

    // 第三人只能觀戰，不能走棋。
    const viewer = await open('/');
    await joinRoom(viewer.page, '阿姨', code);
    await viewer.page.getByText('你正在觀戰').waitFor();
    await cell(viewer.page, square(7, 2)).click();
    assert.equal(await viewer.page.locator('.piece--selected').count(), 0);

    await closeAll(host.context, guest.context, viewer.context);
  });

  test('對手斷線時會顯示狀態，回來後能繼續下', async () => {
    const { host, guest } = await startOnlineGame();
    await guest.context.setOffline(true);
    await guest.page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await move(host.page, square(7, 7), square(4, 7));
    await guest.context.setOffline(false);
    await logHas(guest.page, '炮二平五');
    await closeAll(host.context, guest.context);
  });

  test('用邀請連結直接進房，第一次進入時要輸入名字', async () => {
    const host = await open('/');
    const code = await createRoom(host.page, '媽媽');
    await host.page.getByText('把這組代碼傳給對方').waitFor();
    const guest = await open(`/room/${code}`);
    await guest.page.getByPlaceholder('例如：爸爸、小明').fill('妹妹');
    await guest.page.getByRole('button', { name: '進入房間' }).click();
    await host.page.getByText('妹妹').waitFor();
    assert.equal(await host.page.getByText('把這組代碼傳給對方').count(), 0);
    await closeAll(host.context, guest.context);
  });

  test('不存在的房間會顯示說明', async () => {
    const { page, context } = await open('/online');
    await page.getByPlaceholder('例如：爸爸、小明').fill('訪客');
    await page.getByLabel('房間代碼').fill('9999');
    await page.getByRole('button', { name: '加入房間' }).click();
    await page.getByRole('heading', { name: '找不到這個房間' }).waitFor();
    await context.close();
  });
});

describe('手機', () => {
  test('點在棋子實際顯示的位置就能選中，全盤都對得準', async () => {
    const { page, context } = await open('/local', { ...devices['iPhone 13'] });
    const corners = [
      [0, 0],
      [8, 0],
      [4, 4],
      [0, 9],
      [8, 9],
      [4, 9],
    ] as const;
    const board = (await page.locator('.board').boundingBox())!;
    for (const [x, y] of corners) {
      const point = {
        x: board.x + ((x + 0.5) / 9) * board.width,
        y: board.y + ((y + 0.5) / 10) * board.height,
      };
      const hit = await page.evaluate(
        ({ x: px, y: py }) => document.elementFromPoint(px, py)?.getAttribute('data-square'),
        point,
      );
      assert.equal(hit, String(square(x, y)));
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.equal(overflow, 0, '手機上不應出現水平捲動');
    await context.close();
  });
});

describe('單機模式', () => {
  test('和電腦下棋：電腦會回應，進度在重新整理後保留，結束後存入棋譜', async () => {
    const { page, context } = await open('/ai');
    await page.getByRole('button', { name: '開始下棋' }).click();
    await move(page, square(7, 7), square(4, 7));
    await logHas(page, '炮二平五');
    await page.locator('.log__row').first().locator('.log__move').nth(1).waitFor();

    await page.getByRole('button', { name: '提示' }).click();
    await page.locator('.board__hint').waitFor();

    await page.reload();
    await logHas(page, '炮二平五');

    await page.getByRole('button', { name: '認輸' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '認輸' }).click();
    await page.getByRole('heading', { name: '這盤輸了' }).waitFor();

    await page.goto('/records');
    await page.getByText('0 勝 1 負 0 和').waitFor();
    await page.locator('.record').first().click();
    await page.getByRole('slider', { name: '棋局進度' }).waitFor();
    await page.getByRole('button', { name: '跳到終局' }).click();
    await page.getByRole('button', { name: '上一步' }).click();
    assert.equal(await page.locator('.log__move[aria-current="true"]').count(), 1);
    await context.close();
  });

  test('面對面下棋：絕殺後蓋章，對坐模式會轉動黑方的字', async () => {
    const { page, context } = await open('/local');
    await page.getByLabel('對坐模式：黑方的字朝向對面').check();
    assert.ok((await page.locator('.disc__glyph--flip').count()) > 0);

    const line: [number, number, number, number][] = [
      [7, 7, 7, 5],
      [7, 2, 3, 2],
      [1, 7, 1, 0],
      [5, 0, 4, 1],
      [7, 5, 2, 5],
      [7, 0, 6, 2],
      [2, 5, 2, 0],
    ];
    for (const [x1, y1, x2, y2] of line) await move(page, square(x1, y1), square(x2, y2));
    await page.getByRole('heading', { name: '紅方獲勝' }).waitFor();
    await page.getByText('絕殺').waitFor();
    assert.equal(await page.locator('.seal--stamp').count(), 1);

    await page.getByRole('button', { name: '看看棋盤' }).click();
    await page.getByRole('button', { name: '悔棋' }).click();
    assert.equal(await page.getByRole('heading', { name: '紅方獲勝' }).count(), 0);
    assert.equal(await page.locator('.log__row').count(), 3);
    await context.close();
  });

  test('殘局：答錯會退回，答對會蓋章並記錄進度，多步題也能解完', async () => {
    const { page, context } = await open('/puzzles');
    const puzzle = PUZZLES.find((item) => item.moves === 2)!;
    await page.goto(`/puzzles/${puzzle.id}`);

    let game = createGame(puzzle.fen);
    const key = winningMoves(game, 2)[0]!;

    const keys = winningMoves(game, 2);
    const wrong = legalMovesOf(game).find((candidate) => !keys.includes(candidate))!;
    await move(page, moveFrom(wrong), moveTo(wrong));
    await page.getByText('這步棋來不及將死對方').waitFor();
    await page.locator('.log__empty').waitFor();

    // 依序走出解答，黑方由求解器應對。
    await move(page, moveFrom(key), moveTo(key));
    game = playMove(game, moveFrom(key), moveTo(key))!;
    const reply = toughestDefense(game, 1)!;
    game = playMove(game, moveFrom(reply), moveTo(reply))!;
    await logHas(page, game.moves[1]!.notation);
    const finish = winningMoves(game, 1)[0]!;
    await move(page, moveFrom(finish), moveTo(finish));
    await page.getByText('解開了！').waitFor();

    await page.goto('/puzzles');
    await page.getByText(`已解開 1 / ${PUZZLES.length} 題`).waitFor();
    await context.close();
  });

  test('學棋：可以反覆練習，擺回原位後恢復', async () => {
    const { page, context } = await open('/learn');
    await page.getByRole('button', { name: '俥', exact: true }).click();
    await move(page, square(0, 9), square(0, 3));
    await page.locator('.piece').first().waitFor();
    await page.getByRole('button', { name: '擺回原位' }).click();
    await cell(page, square(0, 9)).click();
    assert.equal(await page.locator('.piece--selected').count(), 1);
    await context.close();
  });

  test('設定：主題與音效選項會被記住', async () => {
    const { page, context } = await open('/settings');
    await page.getByText('青花', { exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'porcelain');
    await page.reload();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'porcelain');
    await context.close();
  });

  test('鍵盤可以完成選子與落子', async () => {
    const { page, context } = await open('/local');
    await cell(page, square(4, 7)).focus();
    for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.piece--selected').count(), 1);
    for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await logHas(page, '炮二平五');
    await context.close();
  });

  test('離線時仍可開啟並和電腦對弈', async () => {
    const { page, context } = await open('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.goto('/ai');
    await page.getByRole('button', { name: '開始下棋' }).click();
    await move(page, square(7, 7), square(4, 7));
    await page.locator('.log__row').first().locator('.log__move').nth(1).waitFor();
    await context.close();
  });
});
