# 后端架构规范

- DDD分层：Application/Domain/Infrastructure/API
- 依赖方向：API→Application→Domain；Infrastructure实现Domain接口
- 业务规则在Domain层，可追溯到需求编号
- 统一错误码、日志规范、敏感信息脱敏
- 禁止循环依赖、禁止层间越权调用
