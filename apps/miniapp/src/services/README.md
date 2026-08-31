# Services

E-008 交付 `@daily-energy/api-client/miniapp` 后，本目录只通过该公开 subpath
连接 `/v1`。E-004 不创建或复制生成客户端。

C-015 的 `submitAnalyticsSignal` 只发送 generated contract 中的八类匿名信号，
不附普通 session，并固定使用短超时；调用方不得建立离线 replay。
