# scripts/ — 后端服务技能脚本

本目录包含 `dev-backend-service` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `layer_check.py` | 分层依赖检查：禁止 Infrastructure/API 反向依赖 Domain/Application | 0/2 |
| `circular_dep_check.py` | 循环依赖检测：基于 import 图 DFS 找环 | 0/2 |

---

## layer_check.py

### 用途
分层依赖检查：扫描代码目录中的 `.java`/`.py` 文件，校验是否存在 Infrastructure/API 层反向依赖 Domain/Application 层的越权调用。当前为简化实现（统计 import 但不阻断），输出 violations 列表与 layer_check 状态。

### 接口
```
python layer_check.py <code_root> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `code_root` | 代码根目录路径，递归扫描 `.java`/`.py` 文件 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无分层违规（violations 为空） |
| 2 | 存在分层违规（violations 非空） |

> 当前实现为骨架版，violations 始终为空，退出码固定为 0。完整分层校验须依赖 ArchUnit 等工具。

### 检查项
1. **文件遍历**：递归扫描 `code_root` 下的 `.java`/`.py` 文件。
2. **import 提取**：逐行扫描 import 语句，识别跨层引用。
3. **依赖方向校验**：按 ALLOWED 映射表校验依赖方向是否合法。
4. **空目录兼容**：目录不存在或为空时输出空 violations（exit=0）。

### 分层依赖规则（ALLOWED）
| 层 | 允许依赖 |
|------|---------|
| api | application, domain, infrastructure |
| application | domain, infrastructure |
| domain | （无，领域层不依赖任何外层） |
| infrastructure | domain |

### 输入 JSON 示例
无需输入 JSON，直接扫描目录：
```
app/
├── api/TransferController.java
├── application/TransferService.java
├── domain/Account.java
└── infrastructure/AccountRepository.java
```

### 输出 JSON 示例
```json
{
  "violations": [],
  "layer_check": "ok"
}
```

### 调用示例
```bash
# 基本分层检查
python skills/dev-backend-service/scripts/layer_check.py app/

# 空目录场景
python skills/dev-backend-service/scripts/layer_check.py empty_dir/

# CI 门禁（退出码驱动）
python skills/dev-backend-service/scripts/layer_check.py app/ && echo "分层检查通过" || echo "分层检查失败"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-backend-service/layer_check.py` 条目（3 用例）：
- `valid_dir`：含 Domain/Model.java 的有效目录 → exit=0，输出含 `layer_check`
- `empty_dir`：空目录 → exit=0，输出含 `layer_check`
- `missing_dir`：目录不存在 → exit=0，输出含 `layer_check`

---

## circular_dep_check.py

### 用途
循环依赖检测：扫描 `.py` 文件中的 import 语句构建依赖图，通过 DFS 检测模块间的双向引用环。输出环列表与环数量。

### 接口
```
python circular_dep_check.py <code_root> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `code_root` | 代码根目录路径，递归扫描 `.py` 文件 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无循环依赖（cycle_count=0） |
| 2 | 存在循环依赖（cycle_count>0） |

### 检查项
1. **import 图构建**：扫描每个 `.py` 文件的 `import`/`from` 语句，提取顶层模块名作为依赖节点。
2. **双向引用检测**：若 A 依赖 B 且 B 依赖 A，记为一条环。
3. **环数量限制**：最多输出前 20 条环，避免大规模代码库输出爆炸。
4. **空目录兼容**：目录不存在或无 `.py` 文件时输出空 cycles（exit=0）。

### 输入 JSON 示例
无需输入 JSON，直接扫描目录：
```
src/
├── a.py    # import b
└── b.py    # import a
```

### 输出 JSON 示例
```json
{
  "cycles": [["a", "b"]],
  "cycle_count": 1
}
```

### 调用示例
```bash
# 循环依赖检测（含环）
python skills/dev-backend-service/scripts/circular_dep_check.py cyclic_src/

# 无环场景
python skills/dev-backend-service/scripts/circular_dep_check.py clean_src/

# CI 门禁（退出码驱动）
python skills/dev-backend-service/scripts/circular_dep_check.py src/ && echo "无循环依赖" || echo "检测到循环依赖"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-backend-service/circular_dep_check.py` 条目（3 用例）：
- `cycle`：a.py import b，b.py import a → exit=2，输出含 `cycle_count`
- `no_cycle`：a.py import os（非项目模块） → exit=0，输出含 `cycle_count`
- `missing_dir`：目录不存在 → exit=0，输出含 `cycle_count`

---

## 能力边界

- 上述脚本为**轻量静态检查**，不替代运行时依赖分析与单元测试。
- `layer_check.py` 当前为骨架实现，violations 始终为空；完整的分层校验须依赖 ArchUnit（Java）或 import-linter（Python）。
- `circular_dep_check.py` 仅检测**双向引用环**（A↔B），不检测 A→B→C→A 等多节点环；多节点环须依赖 import-linter 或 pydeps。
- `circular_dep_check.py` 仅扫描 `.py` 文件，Java/Go 等其他语言的循环依赖须依赖对应工具（ArchUnit/go mod graph）。
- 资金类后端服务的循环依赖须在 L3 档位下额外覆盖跨服务依赖环与启动时依赖图审查。
