# NOTICE

Goden Egg · 会生金蛋的鸡


## ETF 列表与行情

`src/data/etfs.json` 通过腾讯财经公开行情接口的代码区间批量查询整理，
仅保留代码、名称与分类字段，用于本地搜索提示。

行情数据通过腾讯财经公开接口获取，仅用于个人学习与记录。
接口可能随时调整或不可用，本项目不保证行情数据的实时性与准确性。

## A 股休市日历

`src/data/market-holidays.json` 参考上海证券交易所
[2026 年休市安排](https://www.sse.com.cn/disclosure/dealinstruc/closed/c/c_20251222_10802510.shtml)
及 2025 年安排整理，并加入 2027 年元旦休市日期。
节假日安排可能调整，请以交易所最新公告为准。

## 开源依赖

- React / React DOM — MIT
- Vite — MIT
- TypeScript — Apache-2.0
- Recharts — MIT
- date-fns — MIT
- lucide-react — ISC
- clsx — MIT

完整依赖及版本见 `package.json` / `package-lock.json`。
