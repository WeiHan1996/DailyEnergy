# Tests

项目级测试与质量基线目录。

计划覆盖：

- 每日能量稳定种子与规则引擎；
- 幂等、连续点亮和跨日边界；
- AI Schema 校验、重试与模板降级；
- API 集成测试；
- 小程序关键用户旅程；
- 内容安全与高风险响应；
- 数据迁移和隐私删除流程。

测试重点不是只验证“能运行”，还要验证稳定、自然、安全和可恢复。

E-002 只新增 `architecture/boundary-cases.json`：它以 15 个最小 known-fail
case 覆盖 S-30 的 12 类静态 Gate，并单独证明 strict override、TS path alias 与
deep import 会失败。正式 Source-ID registry、测试 metadata、runner 分层和完整
E2E/resilience 骨架仍属于 E-010。
