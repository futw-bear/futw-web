# FUTW Web

富台熊熊 Web 版是一個 [PWA](https://developer.mozilla.org/zh-TW/docs/Web/Progressive_web_apps) 應用程式，用戶能夠在這上面方便地取用台股資訊；搭配 [Rabang OSS](https://github.com/futw-bear/rabang-oss) 還能夠獲取即時資訊與帳戶資料。

## 證券列表同步

應用程式首次開啟時會透過 `GET /api/pub/securities` 下載證券列表，並儲存在瀏覽器的 `localStorage`。之後會以台灣時間每日 08:00 為更新分界，在應用程式開啟、重新回到前景或恢復連線時補充更新。

支援 Periodic Background Sync 的已安裝 PWA 也會註冊背景更新；實際喚醒時間仍由瀏覽器依據裝置電力、網路與使用頻率決定，因此不保證在應用程式完全關閉時精準於 08:00 執行。
