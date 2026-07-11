# Phase 6 — Status

| 任务 | 状态 | 备注 |
|---|---|---|
| backup.sh | ✅ | `pg_dump --no-owner --clean --if-exists -Fc | gzip`；30 天轮转；读 /etc/safety-hazard.env |
| migrate.sh | ✅ | Phase 5 已写，Phase 6 复用 |
| /health 端点 | ✅ | Phase 1，prisma `$queryRaw SELECT 1` 探活 |
| /metrics 端点 | ✅ | Phase 5，@willsoto/nestjs-prometheus（nodejs + Prisma 默认指标） |
| 切流 runbook | ✅ | docs/runbooks/2026-07-02-ts-cutover.md，按分钟级步骤 + 5 分钟回滚预案 |
| **staging 演练 2 轮** | ⏳ **未做** | 需要真实 staging 环境（含 /etc/safety-hazard.env、独立 DB），sandbox 里跑出的是 mock 信号。生产前必须在 staging 演练 2 轮，每次记录回滚时间 < 5 min。 |
| **生产切换窗口 < 30 min** | ⏳ **未做** | 实际切流是 ops 动作，runbook 写好但未执行 |
| **24h P0/P1 监控** | ⏳ **未做** | 监控接入 Prometheus 端点已就绪，但实际盯盘是切流后 24 小时内人工 |

## 上生产前必须补完

1. 真实配置 Prometheus 抓 `/metrics`，配 alert（5xx > 1% / P95 > 2× / queue waiting > 100）
2. 在生产窗口（建议 23:00 - 01:00）按 runbook 跑一遍切流
3. 切流后 24h 人工盯盘

## 不影响代码提交

Phase 6 的未做项是**运营动作**而不是代码缺失。本次 code review + 修复 + 提交推送可以独立进行。
