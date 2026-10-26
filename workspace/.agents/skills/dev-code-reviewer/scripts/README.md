# scripts/ — 代码评审技能脚本

本目录包含 `dev-code-reviewer` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `review_analyzer.py` | 变更影响分析与热点风险识别：按文件统计变更行数并标记热点 | 0 |

---

## review_analyzer.py

### 用途
辅助代码评审：扫描变更代码目录，按文件统计行数并结合文件类型风险权重计算风险分，标记需人工重点评审的热点文件（大文件/高风险文件）。

### 接口
```
python review_analyzer.py <code_root> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `code_root` | 变更代码目录路径，递归扫描 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 分析完成（无论是否检出热点） |

> 本脚本为**辅助分析**，不阻断流程；退出码恒为 0，评审决策由人工根据 hotspots 清单判断。

### 检查项
1. **文件类型风险权重**：
   - `.java`/`.py`/`.js` → 风险权重 1
   - `.sql` → 风险权重 2（SQL 变更风险更高）
2. **行数统计**：统计每个风险文件的行数。
3. **风险分计算**：`score = lines * risk_weight`。
4. **热点标记**：score > 100 的文件进入 hotspots 清单。
5. **空目录兼容**：目录不存在或无风险文件时输出空 hotspots（exit=0）。

### 风险权重表
| 文件后缀 | 风险权重 | 说明 |
|---------|---------|------|
| `.java` | 1 | Java 源码 |
| `.py` | 1 | Python 源码 |
| `.js` | 1 | JavaScript 源码 |
| `.sql` | 2 | SQL 脚本（数据变更风险更高） |

### 输入 JSON 示例
无需输入 JSON，直接扫描目录：
```
src/
├── BigService.java    (400 行，score=400)
├── migration.sql      (60 行，score=120)
└── Small.java         (10 行，score=10)
```

### 输出 JSON 示例
```json
{
  "hotspots": [
    {"file": "src/BigService.java", "lines": 400, "risk": 1, "score": 400},
    {"file": "src/migration.sql", "lines": 60, "risk": 2, "score": 120}
  ]
}
```

### 调用示例
```bash
# 基本热点分析
python skills/dev-code-reviewer/scripts/review_analyzer.py src/

# 大文件热点场景（400 行 Java 文件）
python skills/dev-code-reviewer/scripts/review_analyzer.py large_src/

# CI 集成（输出热点供评审人关注）
python skills/dev-code-reviewer/scripts/review_analyzer.py src/ > review_hotspots.json
```

### 单测对应
`tests/test_scripts.py` 中 `dev-code-reviewer/review_analyzer.py` 条目（3 用例）：
- `hotspot_detected`：400 行 Java 文件 → exit=0，输出含 `hotspots`
- `small_file`：`class A {}` 小文件 → exit=0，输出含 `hotspots`
- `missing_dir`：目录不存在 → exit=0，输出含 `hotspots`

---

## 能力边界

- 本脚本为**热点识别辅助工具**，不替代人工代码评审。
- 风险分仅基于**行数 × 文件类型权重**，无法识别真正的业务风险（如资金计算/权限校验/并发问题）；深层风险须由 L3 字段级审查覆盖。
- 仅扫描 `.java`/`.py`/`.js`/`.sql` 文件，其他类型（如 `.go`/`.ts`/`.vue`）不进入热点清单。
- 阈值固定为 score > 100，无法配置；如需调整阈值须修改脚本。
- 资金类 MR 的评审须在 L3 档位下额外覆盖字段级安全审查、并发安全审查、事务一致性审查。
