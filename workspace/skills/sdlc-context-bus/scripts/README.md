# SDLC 上下文总线脚本

## 脚本清单

| 脚本 | 说明 |
|------|------|
| `context_bus.py` | 上下文总线，管理各阶段结构化上下文的初始化、写入、读取、状态概览与完整性校验 |
| `callback_manager.py` | 回调管理器，管理阶段间缺陷回调的创建、解决、列表与超时检查 |
| `parallel_scheduler.py` | 并行调度器，识别可并行阶段并管理并行组的启动、同步与文件冲突检测 |

## 数据文件

所有脚本统一读写 `.sdlc-demo/context-bus.json`，该文件包含：

```
context-bus.json
├── project          # 项目元数据（名称、需求ID、需求标题）
├── phases           # 各阶段产出（G1-G8，含 agent/status/outputs/context）
├── callbacks        # 回调队列（由 callback_manager.py 维护）
├── parallel_groups  # 并行组（由 parallel_scheduler.py 维护）
└── branches         # 条件分支（预留）
```

## 能力边界

### ✅ 支持的能力
- 结构化 JSON 管理各阶段产出（context-bus.json 统一存储）
- 回调创建 / 解决 / 列表 / 超时检查全闭环
- 并行组识别、启动、同步检查、文件级冲突检测
- 上下文完整性校验（产出文件存在性 + ID链一致性）
- 支持 `--base-dir` 自定义数据目录
- 退出码标准化（0=成功, 1=失败/校验失败/存在冲突）

### ❌ 不支持的能力
- 不依赖第三方库（仅使用 Python 3.10+ 标准库）
- 不修改各阶段产出文件本身，仅管理元数据
- 不执行实际的 Agent 调度（仅生成排程计划与状态检查）
- 不处理条件分支的自动恢复（branches 数组为预留字段）
- 不提供文件级锁实现（冲突检测仅告警，由调用方决定串行化策略）

## context_bus.py

### 子命令

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `init` | `--requirement-id`（必填）`--name` `--title` `--force` | 初始化 context-bus.json |
| `write` | `--phase`（必填, G1-G8）`--agent`（必填）`--outputs`（逗号分隔）`--status` `--context`（JSON） | 写入阶段产出 |
| `read` | `--phase`（必填, G1-G8） | 读取阶段上下文 |
| `status` | 无 | 打印全局状态概览 |
| `validate` | 无 | 校验上下文完整性 |

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 失败 / 校验失败 |

## callback_manager.py

### 子命令

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `create` | `--from-phase`（必填, G1-G8）`--to-agent`（必填）`--reason`（必填）`--defect-file` | 创建回调 |
| `resolve` | `--callback-id`（必填）`--resolution`（必填）`--commit` | 解决回调 |
| `list` | 无 | 列出所有未解决的回调 |
| `check` | 无 | 检查超时回调（重试>3次或开放>2小时） |

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 / 无超时回调 |
| 1 | 失败 / 存在超时回调 |

## parallel_scheduler.py

### 子命令

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `plan` | 无 | 根据当前阶段生成并行计划 |
| `start` | `--group-id`（必填）`--phases`（必填, 逗号分隔） | 启动并行组 |
| `sync` | `--group-id`（必填） | 检查并行组是否全部完成 |
| `conflict` | `--group-id` 或 `--phases`（二选一） | 检测文件级冲突 |

### 并行组定义

| 组ID | 阶段 | 前置条件 | 同步点 |
|------|------|---------|--------|
| P1 | G3 + G4-design | G2 完成 | G5 |
| P2 | G6 + G7 | G5 完成 | G8 |

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 / 无冲突 |
| 1 | 失败 / 存在文件冲突 |

## 使用方法

```bash
# ── 初始化上下文总线 ──
python context_bus.py init --requirement-id REQ-001 --name "示例项目" --title "需求标题"

# ── 写入阶段产出 ──
python context_bus.py write --phase G1 --agent requirement-analyst \
    --outputs .sdlc-demo/01-requirement/需求说明书.md \
    --status completed \
    --context '{"requirement_summary":"参数化限额+预警"}'

# ── 读取阶段上下文 ──
python context_bus.py read --phase G1

# ── 查看状态概览 ──
python context_bus.py status

# ── 校验完整性 ──
python context_bus.py validate

# ── 创建回调（G4发现缺陷）──
python callback_manager.py create --from-phase G4 --to-agent developer \
    --reason "缺陷#001: 边界值遗漏" \
    --defect-file .sdlc-demo/04-test/defect-001.json

# ── 解决回调 ──
python callback_manager.py resolve --callback-id CB-001 \
    --resolution "已补全边界值校验" --commit abc123

# ── 列出未解决回调 ──
python callback_manager.py list

# ── 检查超时回调 ──
python callback_manager.py check

# ── 生成并行计划 ──
python parallel_scheduler.py plan

# ── 启动并行组 ──
python parallel_scheduler.py start --group-id P1 --phases G3,G4-design

# ── 同步检查 ──
python parallel_scheduler.py sync --group-id P1

# ── 冲突检测 ──
python parallel_scheduler.py conflict --group-id P1
```
