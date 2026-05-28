# AI x YOLO Python 練習場

這是一個給工程師在 YOLO 課程結束後使用的線上練習環境。目標是讓學員不用安裝 Python 或額外套件，就能直接在瀏覽器中複習 Python 基礎、YOLO 觀念、訓練流程與課後測驗。

## 目前已具備的功能

- 學員報到：記錄部門、姓名、工號。
- 瀏覽器內 Python 執行：透過 Pyodide 在前端直接執行 Python 程式碼。
- 分段練習關卡：
  - 變數與計算
  - 清單與迴圈
  - 判斷邏輯
  - 函式與 IoU
  - 猜拳 AI 遊戲
  - 自由 Python 沙盒
- 課後測驗：
  - 第一堂：AI 與 YOLO 入門理論
  - 第二堂：Python 與 YOLO 實作
- YOLO 實作練習：可調整 confidence threshold、模型大小、上傳圖片預覽，觀察偵測框與推論統計。
- 成績儲存：透過後端 API 寫入 Supabase，前端不直接暴露 Supabase key。
- 管理後台：透過 Vercel API 驗證管理者帳密後，可檢視統計、篩選學員、匯出 CSV、編輯或刪除紀錄。
- Vercel 部署：目前是單頁靜態網站，可直接部署到 Vercel。

## 適合的課後使用情境

1. 課堂後即時練習  
   學員掃 QR Code 進入平台，直接完成 Python 小任務與測驗。

2. 回家複習  
   學員可重複開啟平台，重新跑程式、看提示、練習基礎語法。

3. 教師追蹤成效  
   講師或管理者可從後台查看各部門完成率、分數與及格狀態。

4. 實作前置訓練  
   在真的進入 GPU / Colab / YOLO 訓練前，先確認學員理解 Python、偵測結果、信心分數、IoU 與模型流程。

## 執行方式

此專案包含靜態前端與 Vercel API。

### 本機預覽

若只要預覽前端畫面，可直接開啟 `index.html`，或在專案目錄中啟動簡單 HTTP server：

```powershell
python -m http.server 5173
```

然後開啟：

```text
http://localhost:5173
```

若要測試報到、成績儲存與管理登入，請使用 Vercel CLI：

```powershell
vercel dev
```

### 部署到 Vercel

專案已包含 `vercel.json`，可以直接以靜態站部署。

建議流程：

1. 將 `yolo-playground` 推到 GitHub。
2. 到 Vercel 匯入該 repository。
3. Framework 選擇 Other / Static。
4. 在 Vercel 設定環境變數。
5. 部署完成後，把 Vercel 網址製作成 QR Code 放進課程投影片。

必要環境變數：

```text
SUPABASE_URL=你的 Supabase 專案 URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service role key
ADMIN_USER=管理者帳號
ADMIN_PASS=管理者密碼
ADMIN_SESSION_SECRET=管理 session 簽章密鑰
```

注意：`SUPABASE_SERVICE_ROLE_KEY` 只能放在 Vercel 環境變數，不可以寫進前端程式碼或 GitHub。

## 建議的下一階段功能

### 第一階段：把目前 MVP 變成正式課後平台

- 為 Supabase `training_records` 建立 RLS policy，讓資料庫層也有保護。
- 將管理 session 改成更完整的登入狀態，例如 HttpOnly cookie 或 Supabase Auth。
- 增加學員完成進度，例如每個關卡是否執行過、是否通過練習。
- 增加每題詳解，讓測驗不只是評分，也能作為複習工具。
- 增加課程教材下載區，例如投影片、範例程式、資料集連結。

### 第二階段：加入真正的 YOLO 實作練習

瀏覽器中的 Pyodide 適合 Python 基礎練習，但不適合直接跑完整 YOLO 訓練。建議採用混合式架構：

- 前端平台：目前的 `index.html` 或改成 React / Next.js。
- 練習執行：
  - Python 基礎：保留 Pyodide。
  - YOLO 推論：使用預先準備好的圖片與後端 API。
  - YOLO 訓練：導向 Google Colab、Kaggle Notebook、JupyterHub 或公司內部 GPU server。
- 成績與紀錄：Supabase / PostgreSQL。
- 檔案上傳：Supabase Storage 或內部物件儲存。

可加入的實作任務：

- 上傳圖片，呼叫 YOLO API 看偵測框。
- 調整 confidence threshold，觀察偵測結果變化。
- 比較不同 YOLO 模型大小，例如 nano / small / medium。
- 標註資料集範例，理解 bounding box 與 class label。
- 修改 Colab Notebook，完成小型資料集訓練。
- 下載訓練結果並回答部署問題。

### 第三階段：變成完整企業訓練系統

- SSO 或公司帳號登入。
- 課程梯次管理。
- 學員完成證明。
- 作業上傳與講師批改。
- 自動生成個人成績報告。
- 依部門、梯次、角色匯出訓練成果。

## 建議平台架構

```text
學員瀏覽器
  |
  |-- 靜態課程頁 / Python Pyodide 練習
  |
  |-- Supabase：報到、測驗、成績
  |
  |-- YOLO API：圖片推論、模型比較
  |
  |-- Colab / JupyterHub：完整訓練實作
```

## 目前專案檔案

```text
yolo-playground/
  api/
    admin-login.js       # 管理者登入 API
    training-records.js  # Supabase 成績資料 API
  index.html    # 主練習平台
  vercel.json   # Vercel 靜態部署設定
  README.md     # 平台說明與擴充規劃
```

## 講師操作建議

課程當天建議流程：

1. 投影片中放入練習場 QR Code。
2. 請學員先完成報到。
3. 第一堂結束後完成第一堂測驗。
4. 第二堂實作前先跑 Python 關卡 1 到 5。
5. YOLO 實作時搭配 Colab 或教師提供的訓練環境。
6. 課後請學員完成第二堂測驗。
7. 從管理後台匯出 CSV，作為訓練成果紀錄。
