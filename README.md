# FUTW Web

富台熊熊 Web 版是一個 [PWA](https://developer.mozilla.org/zh-TW/docs/Web/Progressive_web_apps) 應用程式，用戶能夠在這上面方便地取用台股資訊；搭配 [Rabang OSS](https://github.com/futw-bear/rabang-oss) 還能夠獲取即時資訊與帳戶資料。

## 證券列表同步

應用程式首次開啟時會透過 `GET /api/pub/securities` 下載證券列表，並儲存在瀏覽器的 `localStorage`。之後會以台灣時間每日 08:00 為更新分界，在應用程式開啟、重新回到前景或恢復連線時補充更新。

支援 Periodic Background Sync 的已安裝 PWA 也會註冊背景更新；實際喚醒時間仍由瀏覽器依據裝置電力、網路與使用頻率決定，因此不保證在應用程式完全關閉時精準於 08:00 執行。

## 每日收盤價格同步

應用程式首次開啟時會分別透過 `GET /api/pub/prices?market=TSE` 與 `GET /api/pub/prices?market=OTC` 下載上市、上櫃個股的最後營業日資料，並儲存在 `localStorage` 的 `prices:TSE` 與 `prices:OTC`。

價格資料以台灣時間每日 14:00 為更新分界，使用與證券列表相同的前景補更新及 Periodic Background Sync 機制。應用程式完全關閉時的實際背景更新時間仍由瀏覽器決定。

## 自選清單

首頁自選代號儲存在 `localStorage` 的 `watchlist`。首次使用會自動加入 `2330`、`2317`、`0050`、`2454`、`2412` 與 `2884`；股票名稱取自已同步的 `securities`。TSE 價格使用 `ClosingPrice`，漲跌為 `ClosingPrice - OpeningPrice`；OTC 價格使用 `Close`，漲跌為 `Close - Open`。漲跌比例以開盤價為分母計算，列表同時顯示該筆行情的資料日期。
