# 后端服务实现模板

```text
application/
  UseCase/Service        # 用例编排
domain/
  model/                 # 实体/值对象/聚合根
  service/               # 领域服务与规则
infrastructure/
  repository/            # 数据访问
  client/                # 外部接口
api/
  dto/                   # DTO/VO/Entity映射
  controller/            # REST/gRPC
```

每条业务规则标注需求/规则编号。

---

## L3 必填深度字段

| 字段 | 要求 |
|------|------|
| 规则追溯 | 业务规则↔需求编号↔单测 |
| 错误码 | 统一错误码映射表 |
