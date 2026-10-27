// Seed data for the demo. Everything the pages show starts here; App.state is a mutable copy of it.
(function () {
  var JAVA = '~/work/card-core/card-core-java';
  var LEGACY = '~/work/card-core/card-core-legacy';
  var DOCS = '~/work/card-core/docs';

  // [id, title, updated, cwd, turns, agent, model]
  var rows = [
    ['6b82c08deb3b', 'COBOL 系统迁移 Java 微服务', '2026-10-26 10:45', JAVA, 86, 'Code Agent', 'deepseek-flash'],
    ['f3a1d07c92be', '营销奖励发放幂等问题排查', '2026-10-26 09:12', JAVA, 91, 'Code Agent', 'deepseek-pro'],
    ['0c47e5b19a3d', '代码评审：transaction-service PR #64', '2026-10-25 21:40', JAVA, 10, 'Q&A Agent', 'deepseek-flash'],
    ['8d21f6a0c4e7', '授权服务：过期授权清理后未释放额度', '2026-10-25 17:26', JAVA, 64, 'Code Agent', 'deepseek-pro'],
    ['5e90b3c8d12f', '营销活动状态机 DRAFT→ACTIVE⇄PAUSED→ENDED', '2026-10-25 15:03', JAVA, 33, 'Code Agent', 'deepseek-flash'],
    ['a7c3e81f60b2', '交易服务：按披露组计算月度利息', '2026-10-25 11:18', JAVA, 72, 'Code Agent', 'deepseek-pro'],
    ['21bd9f4e7c05', '现金额度未校验问题确认', '2026-10-24 20:51', DOCS, 6, 'Q&A Agent', 'deepseek-flash'],
    ['c95a02e7b3d8', '分类余额利息批处理并发问题', '2026-10-24 16:37', JAVA, 62, 'Code Agent', 'qwen3-coder'],
    ['3f68d1a9e042', '营销活动：首刷返现规则实现', '2026-10-24 10:09', JAVA, 57, 'Code Agent', 'deepseek-flash'],
    ['e04b7c25f9a1', '补充 transaction-service 单元测试', '2026-10-23 19:44', JAVA, 31, 'Code Agent', 'deepseek-flash'],
    ['7a2fe6c0d8b4', '授权决策拒绝码优先级对齐', '2026-10-23 14:22', JAVA, 53, 'Code Agent', 'deepseek-pro'],
    ['b18c4d93e6f0', '营销奖励回滚与冲正处理', '2026-10-23 09:58', JAVA, 48, 'Code Agent', 'deepseek-flash'],
    ['49e0a7f2c1d6', '日终批量入账迁移为 posting 作业', '2026-10-22 18:15', JAVA, 68, 'Code Agent', 'qwen3-coder'],
    ['d6f3b20a8e91', '解释 CBTRN02C 入账逻辑', '2026-10-22 11:31', LEGACY, 12, 'Q&A Agent', 'deepseek-flash'],
    ['0e95c7d4a3b2', '卡账户交叉引用 XREF 查询性能优化', '2026-10-21 20:06', JAVA, 46, 'Code Agent', 'deepseek-pro'],
    ['6c1a8e5f2b07', '统一错误码与全局异常处理', '2026-10-21 15:47', JAVA, 27, 'Code Agent', 'deepseek-flash'],
    ['92d7b4e0f5c3', '修复集成测试中的时区问题', '2026-10-21 10:12', JAVA, 35, 'Code Agent', 'deepseek-flash'],
    ['ab40f9c62d18', '账户服务：乐观锁冲突重试', '2026-10-20 19:28', JAVA, 38, 'Code Agent', 'deepseek-pro'],
    ['1d8e3a7b0c59', '梳理 copybook CVACT01Y 字段含义', '2026-10-20 14:03', LEGACY, 9, 'Q&A Agent', 'deepseek-flash'],
    ['f7b25c0e9d46', '账单还款接口对接', '2026-10-20 09:40', JAVA, 44, 'Code Agent', 'deepseek-flash'],
    ['58c0e2d9a7f1', '生成 API 契约测试', '2026-10-19 17:55', JAVA, 36, 'Code Agent', 'qwen3-coder'],
    ['c3e9a14f6b20', 'Docker Compose 本地联调失败排查', '2026-10-18 21:19', JAVA, 41, 'Code Agent', 'deepseek-flash'],
    ['2a7d0f8c5e93', '卡服务：更新卡片时覆盖 CVV 的缺陷修复', '2026-10-18 15:36', JAVA, 23, 'Code Agent', 'deepseek-flash'],
    ['e8f14b6d2c70', '整理业务规则目录待确认项', '2026-10-17 16:42', DOCS, 21, 'Code Agent', 'deepseek-pro'],
    ['7d5c2e1a9f84', '欺诈标记 R 含义误用修复', '2026-10-17 10:25', JAVA, 17, 'Code Agent', 'deepseek-flash'],
    ['4b96f0d3e2a5', '客户服务：SSN 与 FICO 校验', '2026-10-16 19:08', JAVA, 19, 'Code Agent', 'deepseek-flash'],
    ['ad3e7c5b81f0', '账户余额与可用额度计算口径澄清', '2026-10-16 11:47', DOCS, 8, 'Q&A Agent', 'deepseek-flash'],
    ['10f8b2e4d6c9', '授权汇总分页查询', '2026-10-15 18:30', JAVA, 24, 'Code Agent', 'qwen3-coder'],
    ['95ae6d0c3b17', 'Flyway 迁移脚本冲突', '2026-10-15 13:02', JAVA, 18, 'Code Agent', 'deepseek-flash'],
    ['cf27a8e1b4d3', '编写 ADR-006 乐观锁决策', '2026-10-14 17:14', DOCS, 13, 'Code Agent', 'deepseek-pro'],
    ['3c0d5f9e8a62', '报表服务：交易明细导出', '2026-10-14 10:36', JAVA, 29, 'Code Agent', 'deepseek-flash'],
    ['86b1e4a7d0f5', '迁移影响评估：VSAM KSDS 到 PostgreSQL', '2026-10-13 16:20', DOCS, 25, 'Q&A Agent', 'deepseek-pro'],
    ['d0a92c6f7e38', '交易类型与分类码表初始化', '2026-10-12 20:44', JAVA, 14, 'Code Agent', 'deepseek-flash'],
    ['5f3e8b1c0a74', 'IAM 登录令牌过期处理', '2026-10-11 15:11', JAVA, 22, 'Code Agent', 'deepseek-flash'],
    ['b7c60e2a9d15', '最后一个管理员不可删除校验', '2026-10-10 10:53', JAVA, 11, 'Code Agent', 'qwen3-coder'],
    ['24e8d7f3b6a0', 'Web UI 交易查询页面分页', '2026-10-09 17:29', JAVA, 15, 'Code Agent', 'deepseek-flash'],
    ['e6a1c9b5f302', 'dev 分支打包源代码并创建发布分支', '2026-10-08 19:02', JAVA, 7, 'Code Agent', 'deepseek-flash']
  ];
  // Who shared each session; the rest are spread over the team.
  var OWNERS = { 'f3a1d07c92be': 'wq', '8d21f6a0c4e7': 'cc', '49e0a7f2c1d6': 'ly', '6b82c08deb3b': 'ln', 'a7c3e81f60b2': 'ln', '3f68d1a9e042': 'wq', 'c95a02e7b3d8': 'ly', '7a2fe6c0d8b4': 'cc' };
  // Deterministic "random" so the numbers stay put across reloads.
  function wiggle(seed, spread) { var x = Math.sin(seed * 9301 + 49297) * 233280; return Math.abs(x - Math.floor(x)) * spread; }
  var sessions = rows.map(function (r, i) {
    var turns = r[4];
    var qa = r[5] === 'Q&A Agent';
    return {
      id: r[0], title: r[1], updated: r[2], cwd: r[3], turns: turns, agent: r[5], model: r[6],
      messages: Math.round(turns * (2.2 + wiggle(i, 1.4))),
      tokens: Math.round(turns * (28000 + wiggle(i + 7, 36000))),
      files: qa ? 0 : Math.max(1, Math.round(turns * (0.12 + wiggle(i + 3, 0.2)))),
      sizeMB: Math.round(turns * (0.11 + wiggle(i + 5, 0.1)) * 10) / 10,
      created: r[2],
      owner: OWNERS[r[0]] || (r[3] === DOCS ? 'zw' : ['ln', 'wq', 'cc', 'ly'][i % 4])
    };
  });

  var prs = [
    [12, '各服务统一 ApiError 与 GlobalExceptionHandler', '2026-09-22'],
    [19, '下游不可用统一映射 503', '2026-09-25'],
    [23, '账户维护改用 @Version 乐观锁', '2026-09-28'],
    [29, '卡片维护并发冲突返回 409', '2026-09-30'],
    [35, '校验错误保留存量提示文案', '2026-10-03'],
    [38, 'customer-service：SSN 首段与 FICO 范围校验', '2026-10-05'],
    [41, '账单支付改为本地 PENDING + 远程扣款', '2026-10-08'],
    [44, 'card-service：卡片更新不再覆盖 CVV', '2026-10-10'],
    [47, '日终入账单笔幂等与部分成功', '2026-10-12'],
    [50, '过期授权清理时释放占用额度', '2026-10-14'],
    [52, '记账 / 还款 / 计息改为领域方法', '2026-10-16'],
    [55, '利息计算按披露组取利率，未命中回落 DEFAULT', '2026-10-18'],
    [58, '返现入账按 rewardId 幂等', '2026-10-19'],
    [61, '新增 marketing-service 奖励评估', '2026-10-21'],
    [63, '入账后触发奖励评估', '2026-10-22'],
    [64, 'transaction-service：交易明细导出', '2026-10-23'],
    [66, '返现失败保留 PENDING 并支持人工重试', '2026-10-24']
].map(function (p) { return { number: p[0], title: p[1], merged: p[2] }; });

  var MINER_V1 = ['跨服务幂等记账', '乐观锁更新账户余额', '统一错误码与异常处理'];
  var MINER_V2 = MINER_V1.concat(['营销奖励发放']);
  // Each archived spec: 范式总结, 代码分析报告 and the PR records it came from (see content/miner/pr-map.json).
  function specFiles(names) {
    var map = JSON.parse((window.TALENTS_CONTENT && window.TALENTS_CONTENT.files['miner/pr-map.json']) || '{}');
    var out = ['miner/index.md'];
    names.forEach(function (n) {
      out.push('miner/' + n + '/summary.md', 'miner/' + n + '/analyzer.md');
      Object.keys(map).filter(function (pr) { return map[pr] === n; }).forEach(function (pr) { out.push('miner/' + n + '/input/prs/' + pr + '/metadata.json'); });
    });
    return out;
  }
  window.MINER_FILES = specFiles;
  var BIZ_FILES = ['doc-knowledge/index.md', 'doc-knowledge/业务规则目录.md', 'doc-knowledge/数据字典.md', 'doc-knowledge/统一语言术语表.md', 'doc-knowledge/五层业务模型.md'];
  var TRAJ = function (topic, skill) { return ['trajectory/' + topic + '/轨迹诊断报告.html', 'trajectory/' + topic + '/改进建议.md', 'trajectory/' + topic + '/Skill改进-' + skill + '.md']; };

  window.SEED = {
    version: 6,
    role: 'admin',
    team: {
      name: '信用卡核心研发组', admin: 'zw', me: 'ln',
      members: [
        { id: 'zw', name: '张伟', title: '业务专家' },
        { id: 'ln', name: '李娜', title: '开发' },
        { id: 'wq', name: '王强', title: '开发' },
        { id: 'cc', name: '陈晨', title: '开发' },
        { id: 'ly', name: '刘洋', title: '开发' }
      ]
    },
    agents: [
      { id: 'Code', name: 'Code Agent' },
      { id: 'QA', name: 'Q&A Agent' },
      { id: 'Reviewer', name: '代码评审助手' }
    ],
    projects: [
      { id: 'p-card', name: '信用卡核心系统', description: '信用卡核心业务从 COBOL / CICS 迁移到 Java 微服务。', sourceIds: ['s-java', 's-legacy', 's-docs', 's-std'] }
    ],
    sources: [
      { id: 's-sessions', type: 'sessions', name: '团队会话', path: '团队成员共享的 iCode 会话', auto: true },
      { id: 's-java', type: 'repo', name: 'card-core-java', path: JAVA, origin: 'git@code.bank.local:card-core/card-core-java.git', branch: 'main',
        commit: { sha: '4e1b7c2', message: '返现失败保留 PENDING 并支持人工重试 (#66)', time: '2026-10-24 15:58' }, prs: 66,
        desc: 'Java 21 微服务，7 个服务和 Web UI' },
      { id: 's-legacy', type: 'repo', name: 'card-core-legacy', path: LEGACY, origin: 'git@code.bank.local:card-core/card-core-legacy.git', branch: 'master',
        commit: { sha: '5be07d4', message: '归档：冻结主机版本 v3.2', time: '2026-09-12 16:20' }, prs: 0,
        desc: 'COBOL / CICS 存量系统，44 个程序，迁移的对照基准' },
      // versions: newest first; a version is recorded only when a check finds changed files, and is named by that check's time.
      { id: 's-docs', type: 'docs', name: '信用卡核心业务文档', path: DOCS, files: 23, desc: '存量系统分析、领域设计和架构决策记录',
        from: { kind: 'git', origin: 'git@code.bank.local:card-core/card-core-docs.git', branch: 'main' },
        lastCheck: '2026-10-26 02:30',
        versions: [
          { at: '2026-10-25 14:20', modified: ['design/05-api-catalog.md'] },
          { at: '2026-10-25 09:05', added: ['design/08-marketing-capability.md', 'design/adr/ADR-009-marketing-integration.md'], removed: ['ops/00-legacy-runbook.md'] },
          { at: '2026-10-18 09:30', modified: ['legacy/03-business-rule-catalog.md', 'design/02-bounded-contexts.md'] },
          { at: '2026-10-09 10:00', initial: 22 }
        ],
        tree: [
          { dir: 'legacy', files: ['01-codebase-inventory.md', '02-five-level-model.md', '03-business-rule-catalog.md', '04-data-dictionary.md', '05-ubiquitous-language.md'] },
          { dir: 'design', files: ['01-domain-analysis.md', '02-bounded-contexts.md', '03-service-decomposition.md', '04-context-map.md', '05-api-catalog.md', '06-traceability-matrix.md', '07-java-conventions.md', '08-marketing-capability.md'] },
          { dir: 'design/adr', files: ['ADR-001-microservices.md', 'ADR-002-identifiers-and-money.md', 'ADR-003-database-per-service.md', 'ADR-004-cross-aggregate-orchestration.md', 'ADR-005-consistency-idempotency.md', 'ADR-006-optimistic-locking.md', 'ADR-007-auth-scope.md', 'ADR-008-password-storage.md', 'ADR-009-marketing-integration.md'] },
          { dir: 'ops', files: ['01-docker-runbook.md'] }
        ] },
      { id: 's-std', type: 'docs', name: '银行开发规范', path: '/Volumes/team-share/standards/bank-dev', files: 10, desc: '行内 Java 开发、安全、数据库与接口规范',
        from: { kind: 'shared' },
        lastCheck: '2026-10-26 02:30',
        versions: [
          { at: '2026-10-22 16:40', added: ['密码与密钥管理规范.md'], modified: ['安全编码指南.md'] },
          { at: '2026-10-12 10:00', initial: 9 }
        ],
        tree: [
          { dir: '', files: ['Java编码规范.md', '安全编码指南.md', '密码与密钥管理规范.md', '数据库设计规范.md', '接口设计规范.md', '日志与审计规范.md', '金额与精度处理规范.md', '异常与错误码规范.md', '单元测试规范.md', '代码评审清单.md'] }
        ] }
    ],
    sessions: sessions,
    prs: { 's-java': prs },
    categories: [
      { id: 'index', name: '知识索引', desc: '快速找到相关的代码和文档' },
      { id: 'doc', name: '文档知识提取', desc: '从需求、设计文档中提取业务知识' },
      { id: 'code', name: '代码知识挖掘', desc: '从 PR 和代码变更中反推开发范式与业务规则' },
      { id: 'traj', name: '轨迹分析', desc: '从 Agent 会话中找出问题和改进点' }
    ],
    capabilities: [
      // update: what the capability does when asked to update an existing artifact; null = it only builds.
      { id: 'codegraph', cat: 'index', name: 'CodeGraph', desc: '为代码仓构建代码图谱，查询符号定义、调用关系和依赖。', input: 'repo', inputLabel: '1 个代码仓', output: '代码图谱索引（MCP 查询）',
        update: '只同步上次构建以来的代码变化' },
      { id: 'doc-index', cat: 'index', name: '文档 RAG 检索', desc: 'BM25 + 向量混合检索，按问题找到相关段落。', input: 'docs', inputLabel: '1 个文档集', output: '检索索引（MCP 查询）',
        update: '只处理新增和修改的文档，移除已删除文档的片段' },
      { id: 'doc-extract', cat: 'doc', name: '业务知识提取', desc: '从文档中提取业务规则、术语、数据字典和业务模型。', input: 'docs', inputLabel: '1 个文档集', output: '业务知识文档', skill: true,
        update: '根据文档变化修订受影响的知识',
        prompt: '从所选文档集中提取业务规则、统一语言术语、数据字典和业务模型，每条知识注明出处。' },
      { id: 'miner-pr', cat: 'code', name: '开发范式挖掘（PR）', desc: '分析已合并的 PR，总结可复用的开发范式。', input: 'repo+pr', inputLabel: '1 个代码仓和若干 PR', output: '开发范式库', skill: true, noUpdate: '每次运行归档新的范式',
        prompt: '总结所选 PR 体现的开发范式，归档到代码仓的开发范式库。' },
      { id: 'miner-diff', cat: 'code', name: '开发范式挖掘（代码片段）', desc: '结合代码仓上下文分析代码片段，总结开发范式。', input: 'repo+snippet', inputLabel: '1 个代码仓和代码片段', output: '开发范式库', skill: true, noUpdate: '每次运行归档新的范式',
        prompt: '总结所给代码片段体现的开发范式，归档到代码仓的开发范式库。' },
      { id: 'traj', cat: 'traj', name: '会话轨迹诊断', desc: '还原 Agent 会话中的错误过程，定位问题并给出改进建议。', input: 'sessions', inputLabel: '1 到多个团队会话', output: '诊断报告和改进建议', skill: true, noUpdate: '每次运行生成新的诊断',
        prompt: '诊断所选会话中 Agent 的过程错误，给出可复用的改进建议。' }
    ],
    tasks: [
      { id: 't-cg-java', name: '', cap: 'codegraph', sources: ['s-java'], schedule: { kind: 'daily', time: '02:00' }, mode: 'update', skipUnchanged: true, input: { from: 'b81d3e9', to: '4e1b7c2' }, status: 'success', lastRun: '2026-10-26 02:00', duration: '12 秒', artifact: 'a-cg-java', created: '2026-10-09 10:20' },
      { id: 't-docidx', name: '', cap: 'doc-index', sources: ['s-docs'], schedule: { kind: 'daily', time: '02:30' }, mode: 'update', skipUnchanged: true, input: { from: '2026-10-18 09:30', to: '2026-10-25 14:20' }, status: 'success', lastRun: '2026-10-26 02:30', duration: '1 分 08 秒', artifact: 'a-docidx', created: '2026-10-10 09:12' },
      { id: 't-cg-legacy', name: '', cap: 'codegraph', sources: ['s-legacy'], schedule: { kind: 'now' }, status: 'success', lastRun: '2026-10-09 10:31', duration: '5 分 47 秒', artifact: 'a-cg-legacy', created: '2026-10-09 10:25' },
      { id: 't-biz', name: '', cap: 'doc-extract', sources: ['s-docs'], mode: 'update', input: { from: '2026-10-18 09:30', to: '2026-10-25 14:20' }, schedule: { kind: 'now' }, status: 'success', lastRun: '2026-10-25 22:31', duration: '18 分 33 秒', artifact: 'a-biz', created: '2026-10-25 22:12' },
      { id: 't-std', name: '', cap: 'doc-extract', sources: ['s-std'], schedule: { kind: 'now' }, status: 'success', lastRun: '2026-10-18 11:22', duration: '9 分 05 秒', artifact: 'a-std', created: '2026-10-18 11:13' },
      { id: 't-miner', name: '', cap: 'miner-pr', sources: ['s-java'], prs: [12, 19, 23, 29, 35, 41, 47, 52, 58, 61, 63, 66], schedule: { kind: 'now' }, status: 'success', lastRun: '2026-10-24 17:10', duration: '26 分 41 秒', artifact: 'a-miner', created: '2026-10-24 16:43' },
      { id: 't-traj-1', name: '', cap: 'traj', sources: ['s-sessions'], sessions: ['49e0a7f2c1d6'], schedule: { kind: 'now' }, status: 'success', lastRun: '2026-10-24 18:02', duration: '7 分 19 秒', artifact: 'a-traj-posting', created: '2026-10-24 17:54' }
    ],
    // published: what developers see; draft: the latest run, waiting for review (revisions are added while reviewing).
    artifacts: [
      // basis: the source state the artifact was built from (a document version, or a commit for code).
      { id: 'a-cg-java', cap: 'codegraph', name: 'card-core-java CodeGraph', desc: '查询 card-core-java 中类、方法的定义与调用关系。', sources: ['s-java'], kind: 'index',
        stats: [['文件', '1,284'], ['节点', '41,206'], ['关系', '152,883']], mcpName: 'codegraph',
        published: { version: 3, at: '2026-10-26 02:05', note: '同步代码变化：3 个新提交', delivery: 'cloud', project: 'p-card', basis: { commit: '4e1b7c2' }, auto: true }, draft: null },
      { id: 'a-cg-legacy', cap: 'codegraph', name: 'card-core-legacy CodeGraph', desc: '查询 COBOL 程序、段落、copybook 的定义和调用关系。', sources: ['s-legacy'], kind: 'index',
        stats: [['文件', '146'], ['节点', '6,318'], ['关系', '18,054']], mcpName: 'codegraph',
        published: { version: 1, at: '2026-10-09 11:00', note: '首次发布', delivery: 'cloud', project: 'p-card', basis: { commit: '5be07d4' } }, draft: null },
      { id: 'a-docidx', cap: 'doc-index', name: '信用卡核心业务文档 RAG 检索', desc: '按问题检索信用卡核心业务文档中的相关段落。', sources: ['s-docs'], kind: 'index',
        stats: [['文档', '23'], ['片段', '1,146'], ['向量维度', '1,024']], mcpName: 'docs-rag',
        published: { version: 4, at: '2026-10-26 02:32', note: '同步文档变化：新增 2、修改 2、删除 1', delivery: 'cloud', project: 'p-card', basis: { version: '2026-10-25 14:20' }, auto: true }, draft: null },
      { id: 'a-biz', cap: 'doc-extract', name: '信用卡核心业务知识', desc: '业务规则目录、数据字典、术语表和五层业务模型，每条注明出处。', sources: ['s-docs'], kind: 'files', folder: '业务知识',
        files: BIZ_FILES, skills: ['cobol-legacy-knowledge', 'bank-domain-payments'], usage: '涉及业务规则、字段含义、术语或业务流程时先查阅',
        published: { version: 1, at: '2026-10-20 16:40', note: '首次发布', delivery: 'local', project: 'p-card', files: BIZ_FILES, basis: { version: '2026-10-18 09:30' },
          over: { 'doc-knowledge/业务规则目录.md': 'doc-knowledge-v1/业务规则目录.md' } },
        draft: { created: '2026-10-25 22:31', task: 't-biz', revisions: [], basis: { version: '2026-10-25 14:20' } } },
      { id: 'a-std', cap: 'doc-extract', name: '银行编码规范要点', desc: '分层、建模、接口与安全约定，以及五类检查规则。', sources: ['s-std'], kind: 'files', folder: '编码规范',
        files: ['doc-knowledge/银行编码规范要点.md'], skills: ['dev-bank-coding-standards'], usage: '编写或评审代码时对照检查',
        published: { version: 1, at: '2026-10-18 14:02', note: '首次发布', delivery: 'local', project: 'p-card', files: ['doc-knowledge/银行编码规范要点.md'], basis: { version: '2026-10-12 10:00' } }, draft: null },
      { id: 'a-miner', cap: 'miner-pr', name: 'card-core-java 开发范式', desc: '从已合并 PR 总结的实现范式，含步骤、约束和示例代码。', sources: ['s-java'], kind: 'files', folder: 'miner',
        specs: MINER_V2, files: specFiles(MINER_V2), skills: ['find-reference-spec'], usage: '开发新需求或修改现有功能前，用 find-reference-spec 查找可参考的范式',
        published: { version: 2, at: '2026-10-24 17:40', note: '新增范式「营销奖励发放」', delivery: 'local', project: 'p-card', specs: MINER_V2, files: specFiles(MINER_V2) },
        history: [{ version: 1, specs: MINER_V1 }], draft: null },
      { id: 'a-traj-posting', cap: 'traj', name: '会话轨迹诊断：日终批量入账迁移', desc: '迁移入账逻辑时的经验规则，以及 Skill cobol-legacy-knowledge 的改进。', sources: ['s-sessions'], sessions: ['49e0a7f2c1d6'], kind: 'files', folder: '经验规则',
        topic: 'posting', files: TRAJ('posting', 'cobol-legacy-knowledge'), skillPatch: 'cobol-legacy-knowledge', usage: '',
        published: null, draft: { created: '2026-10-24 18:02', task: 't-traj-1', revisions: [] } }
    ],
    trajTopics: {
      posting: { skill: 'cobol-legacy-knowledge', title: '日终批量入账迁移', keywords: ['入账', '迁移', '利息', '批处理', 'COBOL', '记账', '还款'] },
      reward: { skill: 'dev-api-integration', title: '营销奖励发放幂等', keywords: ['营销', '奖励', '返现', '幂等', '冲正', '活动'] },
      auth: { skill: 'dev-backend-service', title: '授权清理未释放额度', keywords: ['授权', '额度', '拒绝码', '欺诈', '卡'] }
    },
    // The developer's own machine.
    dev: {
      applied: {
        'a-cg-java': { version: 3, scope: { kind: 'agent', agents: ['Code'] }, at: '2026-10-09 11:20' },
        'a-std': { version: 1, scope: { kind: 'global', dir: 'chrys' }, at: '2026-10-18 15:00' },
        'a-miner': { version: 1, scope: { kind: 'repo', repos: ['s-java'] }, at: '2026-10-22 16:30' },
        'a-biz': { version: 1, scope: { kind: 'repo', repos: ['s-java'] }, at: '2026-10-21 09:10' }
      },
      local: [
        { id: 'l-java', type: 'repo', name: 'card-core-java', path: '~/code/card-core-java', repo: 's-java', index: { at: '2026-10-26 09:02', files: '1,291' }, applied: true },
        { id: 'l-notes', type: 'docs', name: '个人迁移笔记', path: '~/notes/card-core', index: null, applied: false }
      ]
    }
  };
})();
