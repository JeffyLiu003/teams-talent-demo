# Teams × iCode × Talent · 餐饮返现演示

解压后请先看 [快速启动](docs/quick-start.md)，包括双服务启动、端口、停止与可选历史会话导入。

页面设计依据：[Teams 与 Talent 演示页面方案](docs/page-map.md)，包含现有实现依据、一二级页面、角色差异及七个 case 的关系。下面说明当前 v2 已实现的演示入口与运行方式。

独立的本机演示工程，复用当前 Teams 的主题、布局、导航和侧边栏源码。Teams 负责协作交付；iCode 提供可选本机启动入口；历史会话恢复需自行提供素材；Talent 作为独立本机服务承担知识资产库、知识构建、轨迹挖掘和自演进；企业业务知识中台并入 Talent。

设计依据：[演示设计与讨论结论](docs/demo-design.md)。

## 启动

在 macOS 上双击本目录的 **启动演示.command**，或执行：

~~~sh
npm ci
npm run dev
~~~

- Teams：<http://127.0.0.1:45970/teams>
- Talent：<http://127.0.0.1:45980/talent>
- Node.js 24.14.1 已验证。依赖版本固定在 package-lock.json。
- 启动脚本构建界面，在两个独立 Node 进程中启动 Teams 与 Talent；重复打开复用各自服务。停止脚本只停止它记录的服务进程。
- `npm run launch` / `npm run stop` 后台启动或停止两个服务；`npm run launch:teams`、`npm run launch:talent` 与对应 `stop:teams`、`stop:talent` 可单独控制。`npm run start:teams`、`npm run start:talent` 为单服务前台入口。
- 源码修改后需重新 build 并重启服务；npm run dev 在当前终端前台运行。

## iCode Teams 项目数据

侧栏「项目」现在包含「信用卡营销交付」和「iCode Teams」。后者从原 Teams 仓库的项目演示数据导入，可直接打开 <http://127.0.0.1:45970/teams#/projects?project=teams&tab=content>。

- 项目内容：代码仓、成员 A/B/C、AGENTS.md、3 个项目Skill 和 3 份项目文档。
- 任务管理：5 条输入、3 条讨论和 5 条任务，支持任务搜索及版本筛选。
- 任务交付：保留原节点状态、责任人、成果与并行测试准备；任务和节点选择保存在 URL。
- 发布跟踪：10.23、10.30、10.17、10.10 共 4 个版本，保留观察、准备、结束及回退数据，可从任务进入所属版本。
- 3 条原项目 iCode 作业示例可回到关联讨论、交付节点和发布版本。

这是可浏览的原项目演示快照；原成员、相对时间、发布数字及作业内容均保留来源语义。餐饮返现项目继续提供可操作的端到端流程。两个项目的状态独立，浏览导入项目不会修改餐饮返现状态。未连接正在运行的 Teams 业务服务。

数据保存在 fixtures/teams-project.json，包含来源提交、文件 SHA-256 与导入时间。按原仓库当前内容刷新快照：

~~~sh
node --import tsx scripts/import-teams-project.ts /绝对路径/iCode-teams
npm run build
~~~

重新启动演示服务后使用新快照。导入脚本只读取原仓库，在 demo 内写入快照；它使用 demo 已安装的依赖。

## 添加项目

Owner 在项目列表右上方点击「添加项目」，填写名称、说明、代码仓地址与代码仓标识。新项目获得独立 ID，保存后进入自己的项目内容，并同步出现在列表和侧栏；刷新后保留。项目设置可继续编辑基本信息。成员可查看，创建与编辑同时受服务端 Owner 权限保护。

三个项目形态共用「基础信息、资料资产、知识成果、需求材料来源、可用 Skill」内容模板。新增项目支持基础信息维护、插件资产关联和手工引用；初始任务、知识和版本保持空态。选择来源资产后可在 Talent 显式构建演示来源索引，不推断已确认的业务规则。代码仓作为引用保存，不自动拉取。

## 完整演示

以「信用卡营销交付」项目的「餐饮消费返现 · DEMO-MKT-001」串联七个 case。顶部切换林悦（项目 Owner）与陈晨（项目成员），同一需求在各页面保留关联。

1. **项目知识与需求准备（Owner）**：进入「项目 → 项目内容」，查看或补充代码仓、设计与历史需求的资产引用，发起知识整合；进入 Talent「项目知识」查看整合概览、代码图谱、业务知识、资料与版本。在「项目 → 任务管理 → 任务列表」确认需求、分配给陈晨。质量能力在「企业连接 → 其他能力配置 → 质量与安全」维护。
2. **开发前准备（成员）**：进入「项目 → 任务交付 → 需求准备」，阅读背景和验收标准、补充需求材料、选择业务 Skill，点击「采用能力并冻结上下文」。项目顶栏「iCode 作业」沿用原 Teams「开始 iCode 工作」确认弹窗：核对项目、任务节点、目录、角色模型与准备/冻结上下文，确认一次后进入本机 iCode 终端。CardDemo 的真实历史会话作为单独选项；已运行会话只定位核对过的 Ghostty 终端，不再启动重复实例。Agent 管理保留 iCode 与 OpenCode 接入入口。
3. **开发与进度同步（成员）**：在「任务交付 → 开发」点击「开始历史开发回放」。主要开发活动在 iCode；通过 Teams CLI/Skill 回传进度；本演示使用本地 CLI，也可点击「模拟 iCode 同步进度」。同步内容关联同一任务，并显示在 Owner 工作台。
4. **质量检查与验收（成员 → Owner）**：检查流程由 iCode 发起，Teams「任务交付 → 验证」回放 Review、测试、安全报告的结果与证据，依次演示首次失败、修复复测、提交交付包。切换 Owner，在「验收」节点报名、消费 120 元、重复评估、运行边界验收并确认功能验收；也可带理由退回，成员补充后重新提交。历史检查回放不会执行新的扫描，缺失的安全报告保持待验证。
5. **会话上报与项目追溯（成员 → Owner）**：成员从任务的执行记录进入会话详情，关联并上报交付会话；也可用本地 CLI 的 `session report`。Owner 在「团队作业与追溯」查看运行作业、会话记录、基础轨迹统计，并沿项目、需求与历史证据回看。上报保存演示关联，原生历史核验单独展示。
6. **平台自演进（Owner）**：进入 Talent「轨迹分析与知识挖掘」，选择单需求或项目多需求范围并开始分析；随后在「能力演进」分别查看业务 Skill 与 Agent 配置候选、运行演示评估并确认发布。返回 Teams「资源市场」采用新版。旧作业保留 Skill 1.0.0 / Agent r1，项目默认更新为 1.1.0 / r2。
7. **运营观察（Owner）**：在「工作台」查看运营概览、项目进度、工具使用和 Token 用量，按成员、工具和时间筛选，打开明细或关联作业。使用人数按成员去重，区分在线空闲、执行中、等待人工处理和离线；运营与用量为标记清楚的样例，陈晨的任务状态随当前流程变化。

项目内已有的 Skill、Code Agent 和预置用户 Skill 可直接在需求准备中选用，冻结上下文保留本次选择。资源市场的共享发布按单个 Skill 或 Agent 管理，成员可获取或订阅已发布资源；共享发布独立于项目需求分配、准备和开发。旧演示状态中的共享记录继续保留。

顶部「演示指引」会提示当前下一步和对应角色。Owner 可「重置演示」。刷新或重启服务保留各自状态。跨系统链接使用各自 origin，并携带项目、需求及 `demo-role` 演示角色；两个 origin 的 localStorage 独立。此角色参数只用于本机演示，不构成生产认证。

## 角色与导航

| 一级入口 | Owner | 成员 |
| --- | --- | --- |
| 工作台 | 运营概览、项目进度、工具使用、Token 用量 | 我的任务与待办、进行中的作业、个人用量 |
| 项目 | 项目列表及四个项目页签，维护项目与资产、分配及验收 | 相同项目结构，准备上下文、开发、验证及提交成果 |
| 团队 | 我的团队、成员与角色、邀请与申请、团队设置 | 我的团队、成员查看、邀请记录查看 |
| Agent 管理 | 复用原 Teams 实例概览、配置弹窗、启动与维护入口 | 相同入口，查看和使用本机工具 |
| 资源市场 / 我的订阅 / 我的发布 | 三个独立入口，浏览资源、查看采用版本和管理发布 | 相同入口，按权限获取、查看和发布资源 |
| 企业连接 | 外部资产与数据连接；其他能力配置保留质量与安全、模型与工具服务、Talent 接入 | 不显示独立入口 |
| 团队作业与追溯 | 运行作业、会话记录及详情 | 从本人任务进入执行记录 |
| Talent | 项目知识、轨迹分析与知识挖掘、能力演进 | 项目知识与来源 |

项目保留四个页签：**项目内容、任务管理、任务交付、发布跟踪**。任务管理包含信息收集、任务讨论与任务列表；任务交付包含需求准备、开发、验证与验收四个节点。顶栏提供统一「iCode 作业」和项目设置入口。发布跟踪汇总版本范围与交付结论，当前未登记真实部署或上线事实。

Teams 负责项目资产引用、需求材料和交付状态。代码托管、需求、缺陷、设计文档/知识库、测试资产五个独立 mock provider 分别提供原始来源记录；项目只保存选中记录的关联。业务知识是第六类接入插件，从 Talent HTTP API 读取结构化知识。文档插件保留已有原始资料，未构建项目的业务知识为空，不以原文替代知识成果。项目的资料关联选择器使用前五类原始来源；第六类在本项目知识成果区读取，跨项目知识订阅和显式关联尚未实现。当前新增资产不自动抓取外部系统或重新解析文件。成员材料及所选业务 Skill 随上下文冻结；进度通过 Teams CLI/Skill 回传，具体管理入口待定；Agent 管理沿用原 Teams 的工具与配置界面。

团队页支持编辑名称、创建邀请、模拟接受、角色调整和移除，保护林悦与陈晨两位固定演示身份。企业连接支持启用开关及接入说明编辑；这些配置持久化在本地演示状态，启用不表示外部模型、MCP 或扫描服务已连通。

## 服务与状态边界

Teams 的 `server/index.ts` 独占 `.runtime/state.json`，管理项目、关联、需求、交付及采用状态。Talent 的 `server/talent.ts` 独占 `.talent-runtime/talent-state.json`，保存每个项目的知识条目、构建输入、轨迹分析、候选定义与评估结果。两个进程不直接读取或写入对方状态文件。Talent 经 `GET /api/integrations/talent/context` 获取 Teams 上下文，通过限定的 `POST /api/integrations/talent/results` 回传结果；Teams 界面经 Talent 的 `GET /api/knowledge/assets` 读取业务知识。

餐饮返现的旧演示流程仍在 Teams 保留知识就绪、分析阶段和演进版本投影，便于冻结上下文与后续采用；知识正文及候选结果保存在 Talent。旧 Teams 中的 `knowledge=true` 不会自动生成新 Talent 知识，需 Owner 显式构建。回传失败时 Talent 保存待回传状态并显示重试入口。重置 Teams 会更新演示代次，使旧 Talent 成果不再作为本次项目知识返回。

Talent 停止后 Teams 项目服务继续运行；业务知识读取和构建显示连接失败，不替换为静态结果。旧 Teams `/talent` 与 Talent `/teams` 地址显式重定向到对方服务。代码图谱使用已有源码节选与关系映射作为输入，本轮未调用本地工具执行全仓构图；构建、分析和评估仍为 mock。

## 本地演示 CLI 与 Teams 协作 Skill

`skills/teams-demo-collaboration/SKILL.md` 提供实际演示接入说明。用户级 Teams 协作条目引用该文件，Office 三项仍为使用示例。原生启动材料引用此路径和读取命令；文件已提供不代表会话已读取或已采用。独立 demo 名称保留原生产 Skill 和 CLI。

~~~sh
node scripts/teams-demo.mjs --endpoint http://127.0.0.1:45970 context get --project carddemo --task DEMO-MKT-001 --node develop --output /tmp/teams-context.json
node scripts/teams-demo.mjs inputs adopt --operation-id adopt-001 --input-file /tmp/adoption.json
node scripts/teams-demo.mjs progress add --operation-id progress-001 --input-file /tmp/progress.json
node scripts/teams-demo.mjs result submit --operation-id result-001 --input-file /tmp/result.json
node scripts/teams-demo.mjs operation get --operation-id progress-001
~~~

使用所选任务的真实标识；Teams 快照任务例如 `--project teams --task T104 --node review`。新项目未建立任务时可只传项目读取准备信息，任务回传需要有效任务和节点。context 返回需求与验收标准、节点要求、项目关联原文、选用 Skill、Agent 配置版本、Talent HTTP 知识来源和既有采用记录。未冻结返回当前准备信息，冻结后保留既定版本。获取操作保持业务 state 不变，知识服务不可用和缺失冻结版本明确标注。

采用请求填写 `projectId/taskId/nodeId/runId/sessionId/expectedRevision/basisDigest/readReferences`；后两项来自实际读取结果，仅列出实际阅读的引用。进度请求保留 scope、run/session、采用回执的 `adoptionId`，并填写 `expectedRevision/phase/summary/evidence`；phase 支持 started、progress、blocked，阻塞时补 blocker。结果报告需至少一条 evidence，形状为 `{kind:"reference"|"local-file",value,description}`。本地路径只作为本机引用，尚未上传，引用真实性保留原出处核对。角色为本机演示权限，成员成果报告不推进质量门槛或 Owner 验收。

每个逻辑写入使用稳定 operationId。CLI 在发送前把 endpoint 与完整请求保存到 `.runtime/cli-receipts`，成功后保存服务回执；`--receipt-dir` 可指定隔离目录。响应丢失时先 operation get，重试保留原 ID 和完整载荷。同 ID 不同载荷、错误范围、过期 revision 都显式失败并保留请求。CLI 仅允许本机 HTTP origin 并核对 Teams demo 服务标识，不使用生产凭据，不自动重试。

`session report --operation-id OP --input-file FILE` 保留已提交交付的 CardDemo 历史会话追溯关联，需此前同 scope/run/session 的采用记录。普通进度已经携带 session/run；此追溯操作与 Talent 原始会话上传仍分开，当前不会冒充真实轨迹已上传。

## 真实接入与数据边界

- 公开仓库不附带 iCode、原始会话或原始压缩包；使用者自行安装，可通过 `DEMO_ICODE_BINARY` 指定可执行文件。开发目录仍允许相邻 `runtime/icode-0.31.0/icode`。CardDemo 新作业使用已核验的导入源码快照 `workspace/carddemo-java-1025`；自行提供原始素材后，历史恢复使用 `workspace` 目录及会话 `6b82c08d-eb3b-4bdc-b373-54fed16a7fcd`。原 Teams 快照和新增项目按当前演示角色单独绑定本机 Git 根目录并核验 origin，原只读参考仓不可绑定。不会替换系统命令、clone 或在绑定时写入项目目录。
- 作业确认使用原生 `-C / --agent / --model`，恢复额外使用 `--session`。启动前只读获取 Teams 上下文并导出工作标识、Skill 路径和 CLI 命令；iCode 0.31.0 无首轮提示参数，未安装生产 Teams 受管 Hook，因此由终端显示指引并在会话中显式读取，不声称自动加载或自动上报。新会话原生 ID 尚待观测，先用稳定 runId 关联；已有历史会话不自动采用当前任务。核验使用真实 ACP initialize、session/list、_session/history、session/load。核验不会调用模型或发送开发提示。
- 当原生会话已在另一实例运行时，页面显示原生运行进程与终端应用；仅可可靠定位时提供进入入口。Windows 暂不具备可靠窗口定位，提示在原终端继续，不重复恢复。历史读取成功与加载被占用分别呈现，不会关闭或抢占已有会话。
- Windows 通过 PowerShell EncodedCommand 与 ProcessStartInfo 启动新终端；在 Windows Terminal 中运行服务时可复用当前窗口的新标签页。独立控制台使用 Start-Process，不重定向工具标准句柄。macOS 保持 Terminal 路径。回执展示实际终端，只表示系统已受理，原生历史核验单独显示；上下文文件导出不代表 Agent 已读或已采用。Windows 可见桌面与键盘交互尚未人工验证，配置及探针见 [快速启动](docs/quick-start.md)。
- 本地桥是本演示的限定实现，不是完整 Teams Gateway/Core，也不宣称实现生产 work-launch manifest 合同。
- OpenCode 从 PATH 或 `DEMO_OPENCODE_BINARY` 发现程序并探测版本；Windows 自动启动要求 `.exe`，检测到 `.cmd/.bat` 时明确提示配置原生 `opencode.exe` 的绝对路径。当前设备未安装时明确显示未安装。原生配置和会话能力通过标记清楚的接入示例呈现，不修改本机配置。
- 业务流程、账户验收、运营与 Token 数据、组织连接配置，以及 Talent 构建/分析/评估/发布结果均为 mock。项目多需求分析含两条预置样本；历史证据、静态源码分析、模拟交互与真实本机接入各自标记。
- 返现验收使用隔离的固定样例：初始欠款 2550.75，消费 120 后返 6，结果 2664.75。首次奖励已领取，不重复展示首刷奖励。
- 现有安全扫描报告缺失，鉴权及事务边界风险保留。功能验收不会改变生产安全“未验证”状态。
- 两个演示角色用于流程体验，不是生产认证系统。HTTP 服务仅监听 127.0.0.1，写操作验证来源和本次服务令牌。

## 工程结构

~~~text
src/vendor/teams/   Teams 原始 UI 源码快照
src/pages/          Teams、Talent 演示页面
src/domain.ts       双角色业务状态与操作约束
src/workspace.ts    项目资料、团队、进度、上报及接入配置状态
server/             本机 HTTP、原子状态存储、限定 CLI/ACP 桥
fixtures/           真实历史证据、Skill 索引、源码片段与演示蓝图
scripts/            构建、本机启停和 teams-demo.mjs 演示 CLI
tests/              流程、权限、持久化与浏览器验收
~~~

teams-baseline.json 记录来源提交、路径和摘要，6 个 UI 源文件保持原样。演示 page-registry 是独立路由适配。新增样式使用 Teams 主题变量，支持浅深主题。

.runtime 保存 Teams 业务状态、启动回执和导出的上下文；.talent-runtime 保存独立 Talent 产物，两者均不提交。重置业务不会删除原始会话或源码，也不会修改已导出的上下文。

## 验证

~~~sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:projects:e2e
npm run test:talent:services
~~~

七 case 浏览器验收使用本机 Chrome 和 Teams 45971 / Talent 45981，服务隔离验证使用 45976 / 45986，自动创建两套独立临时状态并禁用真实终端启动，不污染实际演示。输出在 test-results。原生启动与 ACP 的验证来自原开发设备；公开仓库未附带该设备素材。

移动本仓库时保持 demo 与 workspace 的同级关系；sessions-original、archives 与 runtime 均未随公开仓库提供，取得匹配素材后才可按原布局额外放置；必要时通过 DEMO_MATERIAL_ROOT 指定素材根目录。地址集中在 server/config.ts；DEMO_PORT / DEMO_STATE_DIR 配置 Teams，DEMO_TALENT_PORT / DEMO_TALENT_STATE_DIR 配置 Talent，默认端口分别为 45970 和 45980。两个进程使用同一组地址配置与不同状态目录；服务启动时拒绝相同端口或相同状态目录。
