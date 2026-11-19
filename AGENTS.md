# AGENTS.md

給在這個儲存庫工作的 AI 工程師（Claude、Codex、Cursor、Gemini 等）與人類維護者的規則。
`CLAUDE.md` 只是引用這個檔案，規則以這裡為準。

## 先讀什麼

1. 這個檔案：規則、不變式、不能做的事。
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)：資料流程、通訊協定、安全措施與「常見修改」。
3. 要動到的那一層的程式；每個檔案開頭的註解說明了它負責什麼。

文件分工：`README.md` 給開發者與部署者，`docs/player-guide.md` 給玩家（家長與孩子），`SECURITY.md` 是安全設計與回報方式，
`CHANGELOG.md` 記錄每個版本的變更，`THIRD_PARTY_NOTICES.md` 是第三方授權。改了玩家看得到的行為，要同步更新玩家指南。

## 專案

親子象棋：線上對戰（四位數代碼）、和電腦練習、面對面、殘局、學下棋、棋譜。
正式網址 <https://online-2-player-chinese-chess.onrender.com/>（Render 免費方案，閒置會休眠）。

- 對象是家長與孩子：沒有自由輸入的聊天、悔棋要對方同意、斷線不判負。新增功能時維持這個定位。
- **獨立專案**：不與其他棋類專案共用程式碼或部署設定。儲存庫名稱是 Online-2-Player-Chinese-Chess，產品名稱是「親子象棋」，npm 套件名稱是 `family-xiangqi`。手談棋館（QiguanGamets）只放連結。
- 介面目前只有繁體中文，規則結果的文字在 `client/lib/copy.ts`。
- 程式碼沒有採用開源授權，著作權由作者保留。新增依賴或素材時，同步更新 `THIRD_PARTY_NOTICES.md`。

## 技術

React 19、TypeScript（strict）、esbuild、自訂 CSS、Node.js 內建 HTTP + `ws` + `zod`。Node 22（`.nvmrc`）。
**這是四個棋類專案中唯一有自己伺服器的**：線上對戰需要能跑 Node.js 與 WebSocket 的平台，不能放在純靜態託管。

## 指令

| 指令               | 用途                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| `npm run dev`      | 開發模式（<http://localhost:3000>）                                                 |
| `npm run lint`     | 型別檢查與格式檢查                                                                  |
| `npm test`         | 單元與整合測試（node:test + tsx）                                                   |
| `npm run build`    | 建置前端與伺服器到 `dist/`；`npm start` 執行建置結果                                |
| `npm run test:e2e` | Playwright 流程，要先 `npm run build`（第一次要 `npx playwright install chromium`） |
| `npm run format`   | Prettier 排版，不手動調整                                                           |

改完程式後 `npm run lint`、`npm test`、`npm run test:e2e` 都要通過。CI（`.github/workflows/ci.yml`）在每次推送都會跑；
`health.yml` 每週檢查正式網站、`/healthz` 與安全公告。

## 分層

```
client ──▶ engine, shared
server ──▶ engine, shared
```

- `engine/` 不依賴 DOM、Node.js 或任何套件，瀏覽器、Worker、伺服器共用。反過來不行。
- `Room` 不碰網路；時間、亂數與 token 由外部注入，棋鐘等邏輯用假時鐘測試。
- 用戶端的儲存只經過 `client/lib/storage.ts`（私密瀏覽時 localStorage 會丟例外）。
- 相對 import 不寫副檔名（與其他棋類專案不同）。

## 不變式

- 線上對局的所有狀態都在伺服器：用戶端只送意圖，由 `server/room.ts` 驗證身分、回合、`ply`、規則與棋鐘。
- 通訊協定的型別在 `shared/protocol.ts`，執行期驗證在 `server/schemas.ts`，新增請求時兩邊都要改。
- 伺服器的防護（訊息大小、限流、Origin 檢查、每個位址的連線數、安全標頭）見 `docs/ARCHITECTURE.md`「安全措施」，
  改動時要在 `tests/server/gateway.test.ts` 補測試。
- 走法查表與編碼是 AI 的效能基礎；改 `engine/moves.ts` 後 perft（44、1,920、79,666、3,290,240）必須維持。
- `Game` 是不可變物件，每次走子都回傳新物件。
- 新增殘局題時，`tests/engine/puzzles.test.ts` 會證明確實是 N 步殺且不能更快。

## 規則

- 困斃判負、長將判負、長捉判負（`engine/chase.ts`）、同一局面第三次出現判和、60 回合未吃子判和、雙方只剩將士象判和。
- 已知缺口：沒有長攔等比賽細則，README 有說明。

## 部署限制

- 正式環境在 Render（免費方案）：推送到 `main` 會自動重新部署，閒置 15 分鐘會休眠，下一次連線約一分鐘後醒來。
- 路由用 History API，`manifest` 的 `start_url` 與 `scope` 都是 `/`，**只能部署在網域根目錄**，不能放在子路徑。
- 房間存在記憶體，重新部署時進行中的對局會消失，也只能跑單一實例。
- 放在反向代理或雲端平台後面時，`TRUST_PROXY` 必須設為 `1`（Render 已設定）。環境變數的完整清單在 README 與 `.env.example`。

## 升級相依套件

執行期只有 `ws` 與 `zod`，其他都是開發工具。升級後跑 `npm run lint`、`npm test`、`npm run build`、`npm run test:e2e`，
再更新 `THIRD_PARTY_NOTICES.md` 的版本號。

## 密鑰

不提交 `.env`。目前沒有任何需要密鑰的服務。

## 不做的事

註冊登入、自由輸入的聊天、跨遊戲戰績、廣告與追蹤程式、把房間存進資料庫（除非先討論）。
