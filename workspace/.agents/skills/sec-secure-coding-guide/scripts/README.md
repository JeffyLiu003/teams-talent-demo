# scripts/ — 安全编码规范技能脚本

本目录包含 `sec-secure-coding-guide` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `secure_code_scan.py` | 安全编码静态检查：SQL注入/XSS/硬编码密钥/DOM XSS等规则扫描，输出违规清单与严重度 | 0/2 |

---

## secure_code_scan.py

### 用途
对代码文件或目录进行安全编码静态检查。内置规则覆盖 SQL 拼接注入、XSS（innerHTML/dangerouslySetInnerHTML）、硬编码密钥、DOM XSS（document.write）等银行高频漏洞模式，逐行扫描并输出违规清单（文件/行号/严重度/规则名）。是代码评审与 CI 门禁的确定性检查器。

### 接口
```
python secure_code_scan.py <target> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `target` | 代码文件或目录路径；目录时递归扫描 `.java`/`.py`/`.js`/`.ts`/`.sql` 文件 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 内置规则
| 规则名 | 匹配模式 | 严重度 |
|--------|---------|--------|
| SQL拼接注入 | `SELECT\s+.*\+` 或 `f['\"].*SELECT` | fatal |
| XSS风险 | `innerHTML\s*=` 或 `dangerouslySetInnerHTML` | critical |
| 硬编码密钥 | `(password\|secret\|token)\s*=\s*['\"][^'\"]{6,}['\"]` | fatal |
| DOM XSS | `document\.write` | critical |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 通过（无 fatal/critical 违规，或目标不存在时也返回 0） |
| 2 | 失败（存在 fatal 或 critical 严重度违规） |

> 退出码判定：仅 fatal 与 critical 违规触发退出码 2；其他严重度（如 warning）不阻断。目标路径不存在时返回 0 且 `count=0`。

### 检查项
1. **路径解析**：目标为文件时扫描单文件；为目录时递归扫描 `.java`/`.py`/`.js`/`.ts`/`.sql`。
2. **文件读取**：UTF-8 编码，读取失败（OSError）时跳过该文件。
3. **逐行扫描**：对每行应用全部规则，命中则记录 `{file, line, severity, rule}`。
4. **严重度判定**：任意违规含 `fatal` 或 `critical` 严重度时退出码为 2。

### 输入
无需独立输入 JSON；扫描目标为命令行参数指定的文件或目录。

### JSON 输出示例
```json
{
  "violations": [
    {"file": "src/app.js", "line": 12, "severity": "critical", "rule": "XSS风险"},
    {"file": "src/config.py", "line": 5, "severity": "fatal", "rule": "硬编码密钥"}
  ],
  "count": 2
}
```

### 调用示例
```bash
# 扫描单个文件
python skills/sec-secure-coding-guide/scripts/secure_code_scan.py src/app.js

# 扫描整个目录（递归）
python skills/sec-secure-coding-guide/scripts/secure_code_scan.py src/ --json

# CI 门禁（存在 fatal/critical 违规则阻断）
python skills/sec-secure-coding-guide/scripts/secure_code_scan.py src/ && echo "安全编码检查通过" || echo "存在高危违规"
```

### 能力边界
- 规则集为内置正则，不动态加载外部规则文件；新增规则须修改脚本。
- 仅支持 `.java`/`.py`/`.js`/`.ts`/`.sql` 五种后缀，其他文件类型不扫描。
- 不做数据流分析，仅做单行正则匹配，复杂跨文件漏洞（如存储型XSS）无法检出。
- 不区分上下文（如测试代码 vs 生产代码），误报需通过白名单机制在下游处理。
- 不输出 CWE 编号或修复建议，仅输出规则名与严重度（由 SKILL.md 知识库补充）。

### 单测对应
`tests/test_scripts.py` 中 `sec-secure-coding-guide/secure_code_scan.py` 条目（3 用例）：
- `xss_detected`：含 `innerHTML = data;` → exit=2，输出含 `violations`
- `clean_file`：`const x = 1;` → exit=0，输出含 `count`
- `missing_path`：路径不存在 → exit=0，输出含 `count`
