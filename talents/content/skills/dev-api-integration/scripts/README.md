# scripts/ — 接口集成技能脚本

本目录包含 `dev-api-integration` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `contract_validate.py` | 契约校验：比对请求/响应样例与契约 schema 字段集合 | 0/2/3 |
| `mock_server.py` | 基于契约生成 Mock 服务配置（JSON Server 风格） | 0/3 |
| `idempotency_test.py` | 幂等性测试：校验重复请求结果一致 | 0/2/3 |

---

## contract_validate.py

### 用途
校验接口契约与实际样例的字段一致性。读取契约 JSON（声明 request/response 必填字段列表）与样例 JSON（实际 request/response 字段值），输出缺失字段清单与匹配结果。

### 接口
```
python contract_validate.py <contract_json> <sample_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `contract_json` | 契约 JSON 路径，格式 `{"request": ["字段名"], "response": ["字段名"]}` |
| `sample_json` | 样例 JSON 路径，格式 `{"request": {...}, "response": {...}}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 契约字段全部命中样例（match=true） |
| 2 | 样例缺失契约声明的字段（match=false） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

### 检查项
1. **契约字段提取**：从 contract_json 的 `request` 与 `response` 数组提取必填字段名。
2. **样例字段比对**：检查样例的 `request`/`response` 对象是否包含全部契约字段。
3. **缺失字段输出**：分别列出 `missing_request_fields` 与 `missing_response_fields`。
4. **match 判定**：两个缺失列表均为空时 match=true。

### 输入 JSON 示例
契约（contract.json）：
```json
{
  "request": ["customer_id", "amount", "currency"],
  "response": ["txn_id", "status", "txn_time"]
}
```
样例（sample.json）：
```json
{
  "request": {"customer_id": "C001", "amount": 100.00, "currency": "CNY"},
  "response": {"txn_id": "T20260811001", "status": "SUCCESS", "txn_time": "2026-08-11T10:00:00+08:00"}
}
```

### 输出 JSON 示例
```json
{
  "missing_request_fields": [],
  "missing_response_fields": [],
  "match": true
}
```

### 调用示例
```bash
# 基本校验（契约 vs 样例）
python skills/dev-api-integration/scripts/contract_validate.py contract.json sample.json

# 缺字段场景（样例少 amount 字段）
python skills/dev-api-integration/scripts/contract_validate.py contract.json incomplete_sample.json

# CI 门禁（退出码驱动）
python skills/dev-api-integration/scripts/contract_validate.py contract.json sample.json && echo "契约校验通过" || echo "契约校验失败"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-api-integration/contract_validate.py` 条目（3 用例）：
- `match`：契约与样例字段一致 → exit=0，输出含 `match`
- `missing_field`：样例缺 `c` 字段 → exit=2，输出含 `missing_request_fields`
- `missing_file`：样例文件不存在 → exit=3，输出含 `error`

---

## mock_server.py

### 用途
基于契约 JSON 生成 Mock 服务配置（JSON Server 风格）。读取契约中的 routes 列表，输出可被 Mock 服务直接消费的路由配置。

### 接口
```
python mock_server.py <contract_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `contract_json` | 契约 JSON 路径，格式 `{"routes": [{"path": "/api/x", "method": "GET", "response": {...}}]}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 成功生成 Mock 配置（含空 routes 也视为成功） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

### 检查项
1. **路由提取**：从契约的 `routes` 数组逐条提取 path/method/response。
2. **方法默认值**：未声明 method 时默认 `GET`。
3. **响应默认值**：未声明 response 时默认空对象 `{}`。
4. **空契约兼容**：契约无 routes 字段时输出空 routes 列表（exit=0）。

### 输入 JSON 示例
```json
{
  "routes": [
    {"path": "/api/transfer", "method": "POST", "response": {"txn_id": "T001", "status": "SUCCESS"}},
    {"path": "/api/balance", "method": "GET", "response": {"balance": 1000.00}}
  ]
}
```

### 输出 JSON 示例
```json
{
  "routes": [
    {"path": "/api/transfer", "method": "POST", "response": {"txn_id": "T001", "status": "SUCCESS"}},
    {"path": "/api/balance", "method": "GET", "response": {"balance": 1000.00}}
  ]
}
```

### 调用示例
```bash
# 从契约生成 Mock 配置
python skills/dev-api-integration/scripts/mock_server.py contract.json

# 空契约场景（输出空 routes）
python skills/dev-api-integration/scripts/mock_server.py empty_contract.json

# 接入 json-server 启动 Mock
python skills/dev-api-integration/scripts/mock_server.py contract.json > mock_routes.json && json-server mock_routes.json
```

### 单测对应
`tests/test_scripts.py` 中 `dev-api-integration/mock_server.py` 条目（3 用例）：
- `routes`：契约含 1 条路由 → exit=0，输出含 `routes`
- `empty_contract`：契约为空对象 → exit=0，输出含 `routes`
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## idempotency_test.py

### 用途
幂等性测试：校验同一请求重复提交后服务端响应是否一致。输入重复请求的响应列表 JSON，输出请求次数与幂等判定。

### 接口
```
python idempotency_test.py <responses_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `responses_json` | 重复请求的响应列表 JSON，格式 `[{...}, {...}, ...]` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 全部响应一致（idempotent=true），含空列表场景 |
| 2 | 响应不一致（idempotent=false） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

### 检查项
1. **响应一致性**：列表中所有响应对象与首条响应逐一比对。
2. **空列表兼容**：输入为空数组时视为 idempotent=true。
3. **请求次数输出**：返回 `requests` 字段表示参与比对的响应数量。

### 输入 JSON 示例
```json
[
  {"code": 0, "txn_id": "T001", "status": "SUCCESS"},
  {"code": 0, "txn_id": "T001", "status": "SUCCESS"}
]
```

### 输出 JSON 示例
```json
{
  "requests": 2,
  "idempotent": true
}
```

### 调用示例
```bash
# 幂等性通过（两次响应一致）
python skills/dev-api-integration/scripts/idempotency_test.py identical_responses.json

# 幂等性失败（响应不一致）
python skills/dev-api-integration/scripts/idempotency_test.py different_responses.json

# CI 门禁（重复提交场景必须幂等）
python skills/dev-api-integration/scripts/idempotency_test.py responses.json && echo "幂等性通过" || echo "幂等性失败"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-api-integration/idempotency_test.py` 条目（3 用例）：
- `identical`：两次响应一致 → exit=0，输出含 `idempotent`
- `different`：两次响应不一致 → exit=2，输出含 `idempotent`
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## 能力边界

- 上述脚本为**轻量确定性校验**，不替代真实联调与压测。
- `contract_validate.py` 仅做**字段集合比对**，不校验字段类型、枚举值、长度、业务规则；深度校验须依赖 OpenAPI 3.0 校验器（如 schemathesis）。
- `mock_server.py` 仅生成路由配置，**不启动 Mock 服务**；需配合 json-server 等 Mock 框架使用。
- `idempotency_test.py` 仅比对响应内容是否一致，**不验证幂等键机制本身**；幂等键设计与有效期须由代码评审把关。
- 资金类接口的幂等性须在 L3 档位下额外覆盖并发重复提交、跨节点重复提交场景。
