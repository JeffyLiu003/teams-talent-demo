# scripts/ — 前端UI技能脚本

本目录包含 `dev-frontend-ui` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `ui_lint.py` | 设计还原度检查：扫描样式文件中的 raw color 与设计令牌 | 0/1 |
| `a11y_check.py` | 可访问性扫描：检查 img 无 alt、按钮无 label 等常见 A11y 问题 | 0/1 |
| `bundle_analyze.py` | 包体积分析：汇总目录下文件体积，标记超大文件 | 0 |

---

## ui_lint.py

### 用途
设计还原度检查：扫描样式文件（.css/.scss/.ts/.tsx/.vue）中的 raw hex 颜色（如 `#FF0000`），若文件同时未使用设计令牌（`--color-primary`），则标记为违规。确保颜色统一走设计令牌。

### 接口
```
python ui_lint.py <source_dir> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `source_dir` | 源码目录路径，递归扫描 `.css`/`.scss`/`.ts`/`.tsx`/`.vue` 文件 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无 raw color 违规（含空目录场景） |
| 1 | 存在 raw color 违规（文件含 hex 颜色但未用设计令牌） |

### 检查项
1. **hex 颜色检测**：正则 `#[0-9a-fA-F]{6}` 匹配 6 位 hex 颜色。
2. **设计令牌检测**：检查文件是否含 `--color-primary`。
3. **违规判定**：文件含 hex 颜色且不含 `--color-primary` 时记为违规。
4. **raw_colors 截断**：每文件最多输出前 5 个 hex 颜色。
5. **issues 截断**：最多输出 20 条违规。
6. **空目录兼容**：目录不存在或无样式文件时输出空 issues（exit=0）。

### 设计令牌识别
| 令牌前缀 | 用途 |
|---------|------|
| `--color-primary` | 主色 |
| `--spacing-` | 间距 |
| `--font-` | 字体 |

### 输入 JSON 示例
无需输入 JSON，直接扫描目录：
```css
/* style.css */
.a { color: #FF0000; }
.b { background: #00FF00; }
```

### 输出 JSON 示例
```json
{
  "issues": [
    {"file": "src/style.css", "raw_colors": ["#FF0000", "#00FF00"]}
  ],
  "count": 1
}
```

### 调用示例
```bash
# 设计还原度检查
python skills/dev-frontend-ui/scripts/ui_lint.py src/

# raw color 场景（含 #FF0000 但无 --color-primary）
python skills/dev-frontend-ui/scripts/ui_lint.py raw_color_src/

# CI 门禁（raw color 为零才放行）
python skills/dev-frontend-ui/scripts/ui_lint.py src/ && echo "还原度检查通过" || echo "存在 raw color 违规"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-frontend-ui/ui_lint.py` 条目（3 用例）：
- `raw_color`：`.a { color: #FF0000; }` → exit=1，输出含 `issues`
- `clean_styles`：`.a { color: var(--color-primary); }` → exit=0，输出含 `issues`
- `missing_dir`：目录不存在 → exit=0，输出含 `issues`

---

## a11y_check.py

### 用途
可访问性扫描：检查前端模板文件（.tsx/.vue/.html）中的常见 A11y 问题，包括 img 无 alt、可点击元素（button/a）无可访问名称。

### 接口
```
python a11y_check.py <source_dir> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `source_dir` | 源码目录路径，递归扫描 `.tsx`/`.vue`/`.html` 文件 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无 A11y 问题（含空目录场景） |
| 1 | 存在 A11y 问题（img 无 alt 或可点击元素无 label） |

### 检查项
1. **img 无 alt 检测**：`<img>` 标签不含 `alt=` 属性。
2. **可点击元素无 label 检测**：`<button>` 或 `<a>` 标签不含 `aria-label` 且紧跟子元素（无文本内容）。
3. **issues 截断**：最多输出前 50 条问题。
4. **空目录兼容**：目录不存在或无模板文件时输出空 issues（exit=0）。

### A11y 规则表
| 规则 | 严重级别 | 说明 |
|------|---------|------|
| img 缺少 alt 属性 | 告警 | 图片须有 alt 文本（可空 alt 表示装饰图） |
| 可点击元素缺少可访问名称 | 告警 | button/a 须有 aria-label 或文本内容 |

### 输入 JSON 示例
无需输入 JSON，直接扫描目录：
```html
<!-- page.html -->
<img src='avatar.png'>
<button><icon /></button>
```

### 输出 JSON 示例
```json
{
  "issues": [
    {"file": "src/page.html", "issue": "img缺少alt属性"},
    {"file": "src/page.html", "issue": "可点击元素缺少可访问名称"}
  ],
  "count": 2
}
```

### 调用示例
```bash
# A11y 扫描
python skills/dev-frontend-ui/scripts/a11y_check.py src/

# img 无 alt 场景
python skills/dev-frontend-ui/scripts/a11y_check.py bad_a11y_src/

# CI 门禁（A11y 问题为零才放行）
python skills/dev-frontend-ui/scripts/a11y_check.py src/ && echo "A11y 检查通过" || echo "存在 A11y 问题"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-frontend-ui/a11y_check.py` 条目（3 用例）：
- `img_no_alt`：`<img src='a.png'>` → exit=1，输出含 `issues`
- `clean_page`：`<img src='a.png' alt='ok'>` → exit=0，输出含 `count`
- `missing_dir`：目录不存在 → exit=0，输出含 `count`

---

## bundle_analyze.py

### 用途
包体积分析：汇总目录下所有文件体积，标记超过阈值的超大文件。用于前端构建产物（dist）的体积门禁。

### 接口
```
python bundle_analyze.py <dist_dir> [--limit_kb <KB>] [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `dist_dir` | 构建产物目录路径，递归扫描所有文件 |
| `--limit_kb` | 大文件阈值（KB），默认 300；超过阈值的文件进入 large_files |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 分析完成（无论是否检出大文件） |

> 本脚本为**分析工具**，不阻断流程；退出码恒为 0，体积门禁决策由 CI 配置判断 large_files 是否非空。

### 检查项
1. **文件体积汇总**：递归统计 dist_dir 下所有文件大小，累加为 total_kb。
2. **大文件标记**：单文件体积超过 `--limit_kb`（默认 300KB）时进入 large_files。
3. **large_files 排序**：按文件路径输出，每条含 file 与 kb（保留 1 位小数）。
4. **空目录兼容**：目录不存在时输出 total_kb=0 与空 large_files（exit=0）。

### 输入 JSON 示例
无需输入 JSON，直接扫描目录：
```
dist/
├── main.js       (50 KB)
├── vendor.js     (400 KB)
└── styles.css    (20 KB)
```

### 输出 JSON 示例
```json
{
  "total_kb": 470.0,
  "large_files": [
    {"file": "dist/vendor.js", "kb": 400.0}
  ]
}
```

### 调用示例
```bash
# 默认阈值（300KB）分析
python skills/dev-frontend-ui/scripts/bundle_analyze.py dist/

# 自定义阈值（200KB）分析
python skills/dev-frontend-ui/scripts/bundle_analyze.py dist/ --limit_kb 200

# CI 集成（输出供体积门禁判断）
python skills/dev-frontend-ui/scripts/bundle_analyze.py dist/ > bundle_report.json
```

### 单测对应
`tests/test_scripts.py` 中 `dev-frontend-ui/bundle_analyze.py` 条目（3 用例）：
- `small_bundle`：小文件 `x=1` → exit=0，输出含 `total_kb`
- `large_bundle`：400000 字符大文件 → exit=0，输出含 `large_files`
- `missing_dir`：目录不存在 → exit=0，输出含 `total_kb`

---

## 能力边界

- 上述脚本为**轻量静态检查**，不替代专业前端工具链（Lighthouse/axe-core/Webpack Bundle Analyzer）。
- `ui_lint.py` 仅检测 **raw hex 颜色与设计令牌共存**，不校验尺寸/字体/间距；完整还原度检查须依赖 Figma Inspect 对齐工具。
- `a11y_check.py` 仅检测 **img alt 与 button/a label** 两类问题；完整 A11y 审查须依赖 axe-core 或 Lighthouse。
- `bundle_analyze.py` 仅统计**文件体积**，不分析模块依赖树与 tree-shaking 效果；深度分析须依赖 Webpack Bundle Analyzer。
- 资金类前端页面须在 L3 档位下额外覆盖字段级校验、表单安全、状态机防重复、异常路径 UI。
