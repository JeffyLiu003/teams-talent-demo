# 快速启动

已验证 Node.js **24.14.1**。Teams 与 Talent 使用两个独立 Node 进程，默认端口分别为 `45970` 和 `45980`。包内**不附带 iCode**；网页演示与 Teams 协作 CLI 不依赖原生工具、模型凭据或历史会话导入。

## Windows / macOS：前台启动

安装 Node.js 后，在 PowerShell 或终端进入解压目录的 `demo` 文件夹；路径可以包含空格：

```sh
cd "你的解压路径/teams-talent-demo/demo"
node --version
npm ci
npm run dev
```

`npm ci` 需要访问 npm 镜像。`dev` 构建前端并在前台启动两个服务；也可分步运行 `npm run build`、`npm start`。终端保持打开，**Ctrl+C** 停止本次前台进程。

- Teams：<http://127.0.0.1:45970/teams>
- Talent：<http://127.0.0.1:45980/talent>

网页右上角可切换 Owner / 成员。业务数据首次启动时生成，分别保存于 `demo/.runtime/state.json`、`demo/.talent-runtime/talent-state.json`；停止服务保留数据。Windows 使用标准 Node/HTTP 路径，尚未在真实 Windows 设备实测；本轮 macOS 解压包验证不等于 Windows 原生工具验证。

## 后台运行与单服务

macOS 已验证的后台方式：

```sh
npm ci
npm run launch
npm run stop
```

`launch` 自动构建并记录 PID。`stop` 只有在端口服务的目录、状态目录与 PID 均匹配时才发送停止信号，失联或不匹配会明确拒绝。Windows 代码已处理 npm 脚本调用与进程标识，但后台生命周期未在 Windows 实机验证，优先使用前台方式。

```sh
npm run launch:teams
npm run launch:talent
npm run stop:talent
npm run stop:teams
```

前台单服务可在构建后运行 `npm run start:teams` 或 `npm run start:talent`，Ctrl+C 停止。Talent 通过 HTTP 读取 Teams 项目；只启动 Teams 时知识入口会明确提示 Talent 未连接。后台日志分别位于 `.runtime/server.log`、`.talent-runtime/server.log`。

## 更换端口

同一设备运行另一份演示时，给两个进程设置同一组地址。macOS 终端：

```sh
export DEMO_PORT=46070
export DEMO_TALENT_PORT=46080
npm run dev
```

Windows PowerShell：

```powershell
$env:DEMO_PORT = "46070"
$env:DEMO_TALENT_PORT = "46080"
npm run dev
```

后台启动与停止需保留同一组环境变量。脚本不会接管其他解压目录或无法核对归属的旧服务。`DEMO_STATE_DIR` / `DEMO_TALENT_STATE_DIR` 可指定两个不同状态目录。

保持 `demo` 与 `workspace` 同级。公开仓库仅提供源码与项目 Skills，未附带 `sessions-original`、`archives` 或 `runtime`。自行取得匹配历史素材后才按原布局额外放置；自定义材料位置时用 `DEMO_MATERIAL_ROOT` 指向材料父目录。

## 可选：自行安装 iCode

没有 iCode 时页面显示未安装，普通演示继续可用。用户需自行安装适合设备的 iCode，并配置模型、Agent 与服务凭据；包内不包含 HOME 配置、API Key 或登录信息。配置 `DEMO_ICODE_BINARY` 为可执行文件的绝对路径，再启动演示服务：

```sh
# macOS 示例，请替换实际路径
export DEMO_ICODE_BINARY="/实际安装目录/icode"
npm run launch
```

Windows PowerShell 使用 `$env:DEMO_ICODE_BINARY = "C:\实际安装目录\icode.exe"`。本机探测与会话合同按 iCode 0.31.0 开发，其他版本需另行核验。

Windows 已实现页面打开原生终端：项目页「iCode 作业」确认后，按确认的目录、Agent、模型及可选历史 session 启动 iCode；Agent 管理的 iCode / OpenCode 入口共用启动器。服务从 Windows Terminal 内启动且检测到 `wt.exe` 时，在当前窗口创建新标签页并保留有效的 `WT_PROFILE_ID`；其他情况使用 PowerShell 创建独立控制台。启动前选定路线，失败会明确报错，不改用另一种终端重复启动。

PowerShell 优先使用 `pwsh.exe`，其次为 Windows PowerShell；可显式配置。下面是 PowerShell 示例，路径须替换为已安装程序的绝对路径：

```powershell
$env:DEMO_ICODE_BINARY = "C:\Tools\iCode\icode.exe"
$env:DEMO_POWERSHELL_BINARY = "C:\Program Files\PowerShell\7\pwsh.exe"
# 可选：强制独立 PowerShell 控制台；不设置则按 WT_SESSION / wt.exe 探测
$env:DEMO_WINDOWS_TERMINAL = "none"
# 可选：使用 OpenCode 原生 exe
$env:DEMO_OPENCODE_BINARY = "C:\Tools\OpenCode\opencode.exe"
npm run dev
```

`DEMO_WINDOWS_TERMINAL` 也可配置 `wt.exe` 的绝对路径；有 `WT_SESSION` 时才复用当前 Terminal 窗口。OpenCode 会检查 PATH 的 `.exe` / `.cmd` / `.bat`；Windows 自动启动只执行 `.exe`。若只发现 npm 的 `opencode.cmd`，请自行取得原生 `opencode.exe` 并设置 `DEMO_OPENCODE_BINARY`，或在原终端手工运行，演示不会自动安装或通过 cmd 再解释参数。Linux 的自动终端启动仍明确不支持。

启动器使用 UTF-16LE EncodedCommand，目录留在 PowerShell 安全字面量中；原生参数通过 ProcessStartInfo 传递，避免 PowerShell 5.1 丢失空串或内嵌双引号。新控制台不重定向工具标准句柄。回执只代表系统受理或创建终端，不代表工具已读取上下文、模型已执行或任务已完成。Windows 已运行历史会话暂不能可靠定位窗口，页面禁用再次进入，提示在原终端继续；不会重复恢复、绕锁或关闭原会话。

macOS 仍使用 Terminal 打开新会话，已运行历史会话只有能核对 Ghostty 终端时才直接进入。macOS 可能要求允许控制终端或确认下载程序来源，按系统提示核对后授权，不关闭系统安全机制。`DEMO_NATIVE_DISABLED=1` 可显式禁用自动原生启动。

本次开发宿主为 macOS，已验证生产启动模块的注入测试、页面/API 合同与 macOS 路由回归；尚未人工验证 Windows 可见窗口、键盘交互及 Windows Terminal 标签页。仓库提供 `node --import tsx tests/windows-terminal-runtime.ts` 与 Windows CI，使用无模型本地探针核对 PowerShell 5.1 / 7 的精确 cwd/argv 和三个控制台句柄；这与人工桌面验收分开记录，不以文件回执冒充交互成功。

## 可选：导入历史会话

公开仓库未附带原始历史素材，网页启动也不会导入历史。只有另外取得匹配且获准使用的素材后，才从 `demo` 目录显式运行：

```sh
node scripts/restore-history.mjs --dry-run
node scripts/restore-history.mjs
```

默认目标是当前用户 HOME 下 `.chrys/sessions/6b82c08deb3b`。脚本迁移 16 个结构化文件的路径，保留大整数精度并生成新检查点；trajectory、mutations、日志与内容快照保持原字节。它不启动模型、不调用 ACP、不修改凭据。导入成功只表示文件迁移成功，不代表该机器上的 iCode 已恢复加载。

已有同名会话或锁时会拒绝（包括 dry-run）；不要覆盖、移动或删除正在使用的会话。同设备已有历史可能绑定旧目录，请在原工作区继续。可用独立临时目录验证：

```sh
node scripts/restore-history.mjs --dry-run --session-root "你的临时目录/teams-history-check"
node scripts/restore-history.mjs --session-root "你的临时目录/teams-history-check"
```

临时目录不会被默认 iCode 自动发现。默认位置导入并配置凭据后，可手工运行 `icode -C "解压目录/workspace" --session 6b82c08d-eb3b-4bdc-b373-54fed16a7fcd`（使用自己的可执行文件路径）。历史 Agent/模型标识不等于新机器已有配置；历史 Unix 命令也不会自动转换为 Windows 命令。旧 COBOL 工程等部分引用未随包提供，不应重放历史部署命令。

## Teams 协作 CLI

在 `demo` 目录先只读获取所选任务上下文，自定义端口时替换 endpoint：

```sh
node scripts/teams-demo.mjs --endpoint http://127.0.0.1:45970 context get --project carddemo --task DEMO-MKT-001 --node prepare
```

Windows PowerShell 可直接运行上面的分字段命令。作业入口提供带 `&` 的绝对路径命令，并用 `--input-file` 读取已导出的 scope JSON；不要把 JSON 内联到 PowerShell 5.1 的原生程序参数中。

完整合同见 `skills/teams-demo-collaboration/SKILL.md`；启动材料会提供当前解压位置的绝对路径。读取不等于采用；进度写入需 scope、run/session、采用回执及稳定操作 ID。iCode 0.31.0 没有首轮提示参数，需在会话中显式阅读工作入口，不宣称自动加载。
