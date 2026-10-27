# scripts/ — 编码规范技能脚本

本目录包含 `dev-bank-coding-standards` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `check_standards.py` | 五类规则静态检查（命名/异常/日志/安全/资源），按致命/严重/告警分级 | 0/2 |

---

## check_standards.py

### 用途
对变更代码做静态规范检查，覆盖命名/异常处理/日志/安全/资源释放五类规则。按致命（fatal）/严重（critical）/告警（major）三级输出违规清单，致命与严重为零时通过。

### 接口
```
python check_standards.py <target> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `target` | 代码文件或目录路径；目录时递归扫描 `.java`/`.py`/`.js`/`.ts` 文件 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无致命/严重违规（by_severity.fatal=0 且 critical=0），含空目录场景 |
| 2 | 存在致命或严重违规（by_severity.fatal>0 或 critical>0） |

> 退出码仅由 fatal 与 critical 决定；major 告警不阻断，但须有解释或跟踪单。

### 检查项
1. **致命规则（fatal）**：
   - 硬编码密钥：`password = 'xxx'` 等模式
   - SQL 拼接注入风险：`SELECT ... WHERE ... ' +` 模式
2. **严重规则（critical）**：
   - 吞异常：`except: pass` / `except: #` / 空 except
   - 空 catch：`catch(...) {}`
3. **告警规则（major）**：
   - 日志打印敏感信息：`print(...token|secret|password...)`
   - 命名过短：1-3 字符的小写标识符
4. **文件/行级定位**：每条 violation 含 file、line、severity、rule、text（截断 80 字符）。
5. **分级统计**：by_severity 按 fatal/critical/major 三级汇总数量。

### 规则分级表
| 严重级别 | 规则 | 模式示例 |
|---------|------|---------|
| fatal | 硬编码密钥 | `password = 'secret123'` |
| fatal | SQL 拼接注入风险 | `SELECT ... WHERE ... ' + var` |
| critical | 吞异常 | `except: pass` |
| critical | 空 catch | `catch (Exception e) {}` |
| major | 日志打印敏感信息 | `print(token)` / `print(secret)` |
| major | 命名过短 | 单字母/双字母/三字母变量名 |

### 输入 JSON 示例
无需输入 JSON，直接扫描代码文件：
```python
# bad.py
password = 'secret123'
try:
    do_something()
except:
    pass
print(token)
```

### 输出 JSON 示例
```json
{
  "violations": [
    {"file": "bad.py", "line": 2, "severity": "fatal", "rule": "硬编码密钥", "text": "password = 'secret123'"},
    {"file": "bad.py", "line": 5, "severity": "critical", "rule": "吞异常", "text": "except:"},
    {"file": "bad.py", "line": 6, "severity": "major", "rule": "日志打印敏感信息", "text": "print(token)"}
  ],
  "by_severity": {"fatal": 1, "critical": 1, "major": 1}
}
```

### 调用示例
```bash
# 单文件检查
python skills/dev-bank-coding-standards/scripts/check_standards.py src/bad.py

# 目录递归检查
python skills/dev-bank-coding-standards/scripts/check_standards.py src/

# CI 门禁（致命/严重为零才放行）
python skills/dev-bank-coding-standards/scripts/check_standards.py src/ && echo "规范检查通过" || echo "存在致命/严重违规"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-bank-coding-standards/check_standards.py` 条目（3 用例）：
- `hardcoded_secret_fatal`：含 `password = 'secret123'` → exit=2，输出含 `fatal`
- `clean_file`：`value = get_value()` → exit=0，输出含 `violations`
- `missing_path`：路径不存在 → exit=0，输出含 `by_severity`

---

## 能力边界

- 本脚本为**轻量正则匹配**，不替代 SonarQube/CodeQL 等专业静态分析工具。
- 规则集为**银行常用子集**，不覆盖全部编码规范；完整规范须接入 SonarQube 规则库。
- `major` 告警（如命名过短）存在**误报风险**（如循环变量 `i`/`j`），须人工复核或加白名单。
- SQL 拼接注入检测为**模式匹配**，无法识别动态拼接的复杂场景；完整注入检测须依赖 SAST 工具。
- 资金类代码的规范检查须在 L3 档位下额外覆盖密钥管理服务调用、敏感字段加密存储、监管报送字段格式等专项规则。
