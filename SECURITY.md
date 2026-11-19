# 安全政策

## 回報問題

發現安全問題（例如可以冒用別人的座位、改動棋局、讓伺服器當掉、讓網站執行外來的程式），
請用 GitHub 的 [Report a vulnerability](https://github.com/ToruSmith/Online-2-Player-Chinese-Chess/security/advisories/new)
私下回報，不要開公開的 Issue。如果那個頁面打不開，請開一則 Issue，只寫「有安全問題想私下回報」，不要寫細節。
一般錯誤與建議請用 [Issues](https://github.com/ToruSmith/Online-2-Player-Chinese-Chess/issues)。

## 安全設計摘要

線上對局的所有狀態都在伺服器，用戶端只送「我想走這步」這類意圖：

| 威脅                         | 防護                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| 竄改棋局、替對方走棋         | `server/room.ts` 驗證身分、回合、`ply`、規則與棋鐘，不合法的請求一律拒絕              |
| 冒用座位、搶走斷線玩家的座位 | 入座時發一組隨機 token（`crypto.randomBytes`），重連必須帶同一組                      |
| 單方面悔棋、改棋局           | 悔棋、提和、重賽都要對方同意                                                          |
| 格式錯誤或惡意的訊息         | 所有輸入經過 zod 驗證；單則訊息上限 2 KB                                              |
| 猜房號、灌請求               | 每條連線與每個來源位址都有權杖桶限流；同一個位址最多 50 條連線                        |
| 跨站 WebSocket 劫持          | 檢查 `Origin`，只接受同站或 `ALLOWED_ORIGINS` 白名單                                  |
| 不當言論                     | 沒有自由輸入的聊天，只有預設短句；名字長度上限 12 字，介面一律當文字顯示              |
| 讀取伺服器上的其他檔案       | 靜態檔案阻擋路徑穿越，只提供建置好的前端                                              |
| 注入腳本、被其他網站嵌入     | CSP（`script-src 'self'`、`frame-ancestors 'self'`）、`nosniff`、`Permissions-Policy` |
| 降級成 HTTP                  | 經由可信代理的 HTTPS 連線加上 HSTS                                                    |

`tests/server/` 用真實的 WebSocket 連線測試上述防護。每週的巡檢（`.github/workflows/health.yml`）會檢查正式網站、
`/healthz` 與執行期套件的安全公告。

## 已知限制

- 房間存在記憶體，伺服器重新啟動時進行中的對局會消失；只能跑單一實例。
- 線上「提示」由玩家自己的裝置計算，建房時可以關閉，但這是約定而不是防作弊機制。
- `TRUST_PROXY=1` 時，限流以代理轉送的 `X-Forwarded-For` 最右邊的位址為準；直接對外時必須保持 `0`，避免偽造。
