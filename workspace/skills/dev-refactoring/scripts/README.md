# scripts/ — 重构技能脚本

本目录包含 `dev-refactoring` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `debt_scanner.py` | 技术债扫描：标记大文件与高复杂度方法（轻量实现） | 0 |

---

## debt_scanner.py

### 用途
技术债扫描：扫描代码目录中的 `.java`/`.py`/`.js` 文件，标记大文件（行数 > 300）与高复杂度方法，输出技术债清单供重构优先级排序。

### 接口
```
python debt_scanner.py <code_root> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `code_root` | 代码根目录路径，递归扫描 `.java`/`.py`/`.js` 文件 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 扫描完成（无论是否检出技术债） |

> 本脚本为**分析工具**，不阻断流程；退出码恒为 0，重构决策由人工根据 large_files/high_complexity 清单判断。

### 检查项
1. **文件类型过滤**：仅扫描 `.java`/`.py`/`.js` 文件。
2. **大文件检测**：行数 > 300 的文件进入 large_files 清单，含 file 与 lines。
3. **高复杂度方法检测**：扫描 `def `/`public `/`private ` 开头的方法定义（当前为骨架实现，high_complexity 始终为空）。
4. **空目录兼容**：目录不存在或无代码文件时输出空清单（exit=0）。

### 技术债分级表
| 类型 | 阈值 | 字段 |
|------|------|------|
| 大文件 | 行数 > 300 | large_files[].file, large_files[].lines |
| 高复杂度方法 | （骨架实现，暂未启用） | high_complexity |

### 输入 JSON 示例
无需输入 JSON，直接扫描目录：
```
src/
├── BigService.py    (400 行)
├── Small.py         (10 行)
└── HugeService.java (500 行)
```

### 输出 JSON 示例
```json
{
  "high_complexity": [],
  "large_files": [
    {"file": "src/BigService.py", "lines": 400},
    {"file": "src/HugeService.java", "lines": 500}
  ]
}
```

### 调用示例
```bash
# 基本技术债扫描
python skills/dev-refactoring/scripts/debt_scanner.py src/

# 大文件场景（400 行 Python 文件）
python skills/dev-refactoring/scripts/debt_scanner.py large_src/

# CI 集成（输出供重构优先级排序）
python skills/dev-refactoring/scripts/debt_scanner.py src/ > debt_report.json
```

### 单测对应
`tests/test_scripts.py` 中 `dev-refactoring/debt_scanner.py` 条目（3 用例）：
- `large_file`：400 行 `pass` 的 Big.py → exit=0，输出含 `large_files`
- `small_file`：`x = 1` 小文件 → exit=0，输出含 `large_files`
- `missing_dir`：目录不存在 → exit=0，输出含 `large_files`

---

## 能力边界

- 本脚本为**轻量技术债扫描**，不替代专业代码质量工具（SonarQube/CodeClimate）。
- `large_files` 仅基于**行数阈值（>300）**，不区分业务复杂度；行数少但逻辑复杂的文件不会被标记。
- `high_complexity` 为**骨架实现**，始终为空；复杂度检测（圈复杂度/认知复杂度）须依赖 SonarQube 或 radon。
- 仅扫描 `.java`/`.py`/`.js` 文件，其他语言（Go/TS/Vue）不进入扫描。
- 阈值固定为 300 行，无法配置；如需调整阈值须修改脚本。
- 资金类核心逻辑的重构须在 L3 档位下额外覆盖字段级行为等价、异常路径等价、事务与并发安全保持、回滚方案。
