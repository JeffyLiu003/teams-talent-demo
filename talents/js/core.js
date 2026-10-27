// Shared helpers for the demo: state, formatting, layers (drawer / dialog / toast), the simulated
// task runner and the mock "ask iCode" session filter. Pages live in js/pages/*.js.
window.App = (function () {
  var STORAGE_KEY = 'talents.demo.state';
  var App = { pages: {}, actions: {}, state: null, route: { page: 'sources', params: {} } };

  // ---------- State ----------
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  App.load = function () {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
    App.state = saved && saved.version === window.SEED.version ? saved : clone(window.SEED);
  };
  App.save = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(App.state)); } catch (e) { /* demo still works without storage */ }
  };
  App.reset = function () {
    App.state = clone(window.SEED);
    App.save();
  };
  App.uid = function (prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 8); };

  // ---------- Lookups ----------
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  App.source = function (id) { return byId(App.state.sources, id); };
  App.cap = function (id) { return byId(App.state.capabilities, id); };
  App.cat = function (id) { return byId(App.state.categories, id); };
  App.task = function (id) { return byId(App.state.tasks, id); };
  App.artifact = function (id) { return byId(App.state.artifacts, id); };
  App.session = function (id) { return byId(App.state.sessions, id); };
  App.project = function (id) { return byId(App.state.projects, id); };
  App.agent = function (id) { return byId(App.state.agents, id); };
  App.projectsOf = function (sourceId) { return App.state.projects.filter(function (p) { return p.sourceIds.indexOf(sourceId) >= 0; }); };
  App.projectRepos = function (projectId) {
    var p = App.project(projectId);
    return p ? p.sourceIds.map(App.source).filter(function (s) { return s && s.type === 'repo'; }) : [];
  };
  // Sessions belong to the project whose code repository contains their working directory.
  App.sessionProject = function (session) {
    var found = null;
    App.state.projects.forEach(function (p) {
      p.sourceIds.forEach(function (sid) {
        var s = App.source(sid);
        if (s && session.cwd.indexOf(s.path) === 0) found = p;
        if (s && s.type === 'docs' && session.cwd.indexOf(s.path) === 0) found = p;
      });
    });
    return found;
  };
  // An artifact belongs to every project that holds one of its sources; session artifacts follow their sessions.
  App.artifactProjects = function (a) {
    var ids = {};
    a.sources.forEach(function (sid) { App.projectsOf(sid).forEach(function (p) { ids[p.id] = p; }); });
    (a.sessions || []).forEach(function (id) { var s = App.session(id); var p = s && App.sessionProject(s); if (p) ids[p.id] = p; });
    return Object.keys(ids).map(function (k) { return ids[k]; });
  };

  // ---------- Source changes ----------
  // Document sets: a check that finds changed files records a version (newest first), named by the check's time.
  App.latestVersion = function (src) { return src && src.versions && src.versions.length ? src.versions[0].at : null; };
  // Net changes after version `since` up to the latest: a file added then removed drops out, added then modified stays added.
  App.docChanges = function (src, since) {
    var state = {}, out = { from: since, to: App.latestVersion(src), added: [], modified: [], removed: [] };
    (src.versions || []).slice().reverse().forEach(function (v) {
      if (since && v.at <= since) return;
      if (!since && v.initial) return;
      (v.added || []).forEach(function (f) { state[f] = state[f] === 'removed' ? 'modified' : 'added'; });
      (v.modified || []).forEach(function (f) { if (!state[f]) state[f] = 'modified'; });
      (v.removed || []).forEach(function (f) { state[f] = state[f] === 'added' ? null : 'removed'; });
    });
    Object.keys(state).forEach(function (f) { if (state[f]) out[state[f]].push(f); });
    out.count = out.added.length + out.modified.length + out.removed.length;
    return out;
  };
  App.changeCounts = function (c) {
    return [['新增', c.added], ['修改', c.modified], ['删除', c.removed]].filter(function (x) { return x[1].length; })
      .map(function (x) { return x[0] + ' ' + x[1].length; }).join('、');
  };
  // Where an artifact (or a run) starts from: the latest document version, or the current commit.
  App.sourceState = function (src) {
    if (!src) return null;
    if (src.type === 'docs') return { version: App.latestVersion(src) };
    if (src.type === 'repo') return { commit: src.commit.sha };
    return null;
  };
  App.basisOf = function (a) { return (a.draft && a.draft.basis) || (a.published && a.published.basis) || null; };
  // What changed in the artifact's source since its basis; null when the capability cannot tell.
  App.changesSince = function (src, basis) {
    if (!src || !basis) return null;
    if (src.type === 'docs') { var c = App.docChanges(src, basis.version); c.text = App.changeCounts(c); return c; }
    if (src.type === 'repo') {
      var n = basis.commit === src.commit.sha ? 0 : 3;
      return { from: basis.commit, to: src.commit.sha, count: n, text: n ? n + ' 个新提交' : '' };
    }
    return null;
  };
  App.versionLabel = function (at) { return at ? App.when(at) + ' 版本' : ''; };

  // ---------- Formatting ----------
  var esc;
  App.esc = esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  App.num = function (n) { return Number(n).toLocaleString('en-US'); };
  App.tokens = function (n) { return n >= 10000 ? (Math.round(n / 1000) / 10) + ' 万' : App.num(n); };
  App.now = function () {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  App.when = function (s) {
    if (!s) return '';
    var today = App.now().slice(0, 10);
    return s.slice(0, 10) === today ? '今天 ' + s.slice(11) : s.slice(5);
  };
  App.sourceIcon = function (type) { return { repo: '⌘', docs: '▤', sessions: '◎' }[type] || '▤'; };
  App.capIcon = function (cap) { return { index: '≣', doc: '❏', code: '⟁', traj: '↯' }[cap.cat] || '✦'; };
  App.taskName = function (t) {
    if (t.name) return t.name;
    var cap = App.cap(t.cap);
    var what = t.sessions ? t.sessions.length + ' 个会话' : t.sources.map(function (id) { var s = App.source(id); return s ? s.name : '已移除的来源'; }).join('、');
    return cap.name + '：' + what;
  };
  App.scheduleText = function (s) {
    if (s.kind === 'daily') return '每天 ' + s.time;
    if (s.kind === 'once') return s.at.replace('T', ' ');
    return '立即执行';
  };

  // ---------- Markdown ----------
  App.markdown = function (text) {
    var front = '';
    var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
    if (m) {
      text = text.slice(m[0].length);
      var rows = m[1].split(/\r?\n/).filter(function (l) { return /^\w[\w-]*:/.test(l); }).map(function (l) {
        var i = l.indexOf(':');
        return '<dt>' + App.esc(l.slice(0, i)) + '</dt><dd>' + App.esc(l.slice(i + 1).trim().replace(/^["']|["']$/g, '')) + '</dd>';
      }).join('');
      if (rows) front = '<dl class="fields frontmatter">' + rows + '</dl>';
    }
    var html = window.marked ? window.marked.parse(text) : '<pre>' + App.esc(text) + '</pre>';
    // Highlight added lines in ```diff blocks.
    html = html.replace(/<code class="language-diff">([\s\S]*?)<\/code>/g, function (m, code) {
      return '<code class="language-diff">' + code.split('\n').map(function (l) { return /^\+/.test(l) ? '<span class="diff-add">' + l + '</span>' : l; }).join('\n') + '</code>';
    });
    return front + html;
  };
  App.content = function (key) {
    var c = window.TALENTS_CONTENT;
    return c && c.files && c.files[key] != null ? c.files[key] : null;
  };
  App.skillTree = function (name) {
    var c = window.TALENTS_CONTENT;
    return (c && c.trees && c.trees['skills/' + name]) || ['SKILL.md'];
  };

  // ---------- Layers ----------
  var stack = [];
  function layerRoot() { return document.getElementById('layer'); }
  function openLayer(kind, opts) {
    var overlay = document.createElement('div');
    overlay.className = 'overlay';
    var panel = document.createElement('section');
    panel.className = kind + (opts.className ? ' ' + opts.className : '');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.innerHTML =
      '<header class="panel-head"><div>' + (opts.eyebrow ? '<div class="caption">' + opts.eyebrow + '</div>' : '') + '<h2>' + opts.title + '</h2></div>' +
      '<div class="actions">' + (opts.headActions || '') + '<button class="close" data-close aria-label="关闭">×</button></div></header>' +
      '<div class="panel-body">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<footer class="panel-foot">' + opts.foot + '</footer>' : '');
    layerRoot().append(overlay, panel);
    var layer = {
      el: panel,
      body: panel.querySelector('.panel-body'),
      close: function () {
        if (layer.closed) return;
        layer.closed = true;
        overlay.remove(); panel.remove();
        stack.splice(stack.indexOf(layer), 1);
        if (opts.onClose) opts.onClose();
      },
      setFoot: function (html) { var f = panel.querySelector('.panel-foot'); if (f) f.innerHTML = html; },
      setTitle: function (html) { panel.querySelector('.panel-head h2').innerHTML = html; }
    };
    overlay.addEventListener('click', function () { layer.close(); });
    panel.querySelector('[data-close]').addEventListener('click', function () { layer.close(); });
    stack.push(layer);
    var focusable = panel.querySelector('[autofocus]') || panel.querySelector('[data-close]');
    if (focusable) focusable.focus();
    return layer;
  }
  App.drawer = function (opts) { return openLayer('drawer', opts); };
  App.dialog = function (opts) { return openLayer('dialog', opts); };
  App.top = function () { return stack[stack.length - 1]; };
  App.closeAll = function () { while (stack.length) stack[stack.length - 1].close(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

  App.confirm = function (title, message, okText, danger) {
    return new Promise(function (resolve) {
      var answered = false;
      var d = App.dialog({
        title: title, className: 'small',
        body: '<div class="form-body"><p>' + message + '</p></div>',
        foot: '<button data-no>取消</button><button class="' + (danger ? 'danger' : 'primary') + '" data-yes>' + okText + '</button>',
        onClose: function () { if (!answered) resolve(false); }
      });
      d.el.querySelector('[data-no]').onclick = function () { d.close(); };
      d.el.querySelector('[data-yes]').onclick = function () { answered = true; d.close(); resolve(true); };
      d.el.querySelector('[data-yes]').focus();
    });
  };

  // A small menu next to a button; closes on the next click anywhere.
  App.popMenu = function (anchor, items) {
    var old = document.querySelector('.pop-menu'); if (old) old.remove();
    var m = document.createElement('div');
    m.className = 'pop-menu';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.textContent = it[0];
      b.onclick = function (e) { e.stopPropagation(); m.remove(); it[1](); };
      m.append(b);
    });
    var r = anchor.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 4) + 'px';
    m.style.left = Math.max(8, r.right + window.scrollX - 140) + 'px';
    document.body.append(m);
    setTimeout(function () { document.addEventListener('click', function close() { m.remove(); document.removeEventListener('click', close); }); });
  };

  App.toast = function (text) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.getElementById('toast').append(t);
    setTimeout(function () { t.remove(); }, 2600);
  };

  // ---------- Routing ----------
  // Pages register with the entry (admin / dev) they belong to; the nav follows the current entry.
  App.nav = {
    admin: [['sources', '▤', '来源管理'], ['capabilities', '✦', '知识能力'], ['tasks', '◷', '知识任务'], ['review', '☑', '产物审阅']],
    dev: [['knowledge', '❏', '项目知识'], ['local', '⌕', '本地索引']]
  };
  App.home = { admin: 'sources', dev: 'knowledge' };
  App.parseHash = function () {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('?');
    var params = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (kv) { var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); } });
    var page = App.pages[parts[0]] ? parts[0] : App.home[App.state.role];
    return { page: page, params: params };
  };
  App.go = function (hash) { if (location.hash === hash) App.render(); else location.hash = hash; };
  App.member = function (id) { return byId(App.state.team.members, id); };
  // Sessions team members share; sharing itself is set in iCode Teams.
  App.teamSessions = function () { return App.state.sessions; };
  App.renderChrome = function () {
    var st = App.state, page = App.pages[App.route.page];
    var role = page.role || st.role;
    if (role !== st.role) { st.role = role; App.save(); }
    document.querySelectorAll('[data-action="switch-role"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.role === role)); });
    var me = App.member(role === 'admin' ? st.team.admin : st.team.me);
    document.querySelector('[data-who]').textContent = me.name + '（' + (role === 'admin' ? '管理员' : '开发者') + '）';
    document.querySelector('[data-team]').textContent = st.team.name;
    document.querySelector('[data-role-label]').textContent = role === 'admin' ? '管理员端' : '开发者端';
    document.querySelector('[data-nav-list]').innerHTML = App.nav[role].map(function (n) {
      return '<a href="#/' + n[0] + '"' + (n[0] === App.route.page ? ' aria-current="page"' : '') + '><span class="nav-icon" aria-hidden="true">' + n[1] + '</span>' + n[2] + '</a>';
    }).join('');
    document.querySelector('[data-breadcrumb]').innerHTML = esc(role === 'admin' ? '管理员端' : '开发者端') + ' <span>/</span> <b>' + esc(page.crumb ? page.crumb(App.route.params) : page.title) + '</b>';
    document.title = page.title + ' · iCode Talents';
  };
  App.render = function (keepScroll) {
    var container = document.getElementById('app');
    var page = App.pages[App.route.page];
    var y = window.scrollY;
    var html = page.render(App.route.params);
    container.className = 'page' + (page.wide ? ' page-wide' : '');
    container.innerHTML = html;
    App.renderChrome();
    if (keepScroll) window.scrollTo(0, y);
    if (page.mount) page.mount(container, App.route.params);
  };
  App.refresh = function () { App.render(true); };

  // Clicks on [data-action] go to App.actions[name](element, event).
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = App.actions[el.dataset.action];
    if (!fn) return;
    // Checkboxes keep their native toggle; everything else is a command.
    if (el.tagName !== 'INPUT') e.preventDefault();
    fn(el, e);
  });

  // ---------- Simulated task runs ----------
  // A run lasts `seconds`; its steps and log lines are revealed as time passes. Logs follow the real engines' output.
  App.hashId = function (seed, len) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var hex = ('00000000' + h.toString(16)).slice(-8);
    return (hex + hex.split('').reverse().join('')).slice(0, len || 12);
  };
  // The artifact a run of this task would build or update (same capability on the same input).
  App.existingArtifact = function (task) {
    return App.state.artifacts.filter(function (x) {
      if (x.cap !== task.cap && !(task.cap === 'miner-diff' && x.cap === 'miner-pr')) return false;
      if (task.cap === 'traj') return sameSet(x.sessions, task.sessions);
      return x.sources[0] === task.sources[0];
    })[0] || null;
  };
  App.runPlan = function (task) {
    var cap = App.cap(task.cap);
    var src = App.source(task.sources[0]);
    var sid = App.hashId(task.id || 'task');
    var update = task.mode === 'update' && task.input;
    var ch = update && src ? App.changesSince(src, src.type === 'docs' ? { version: task.input.from } : { commit: task.input.from }) : null;
    if (task.cap === 'traj') {
      var n = task.sessions.length;
      var logs = ['• iCode：Code Agent 就绪，会话 ' + sid, '→ skill  session-trajectory-diagnosis', '读取 ' + n + ' 个会话的轨迹'];
      task.sessions.slice(0, 6).forEach(function (id, i) {
        var s = App.session(id);
        logs.push('[' + (i + 1) + '/' + n + '] ' + (s ? s.title : id) + '：还原 ' + (s ? s.turns : '') + ' 轮对话的因果链');
      });
      if (n > 6) logs.push('… 其余 ' + (n - 6) + ' 个会话');
      logs.push('定位过程错误：覆盖不全 2 处、验证错误 1 处、虚假完成声明 1 处', '→ write  轨迹诊断报告.html', '→ write  改进建议.md', '✓ Done，会话 ' + sid);
      return { seconds: Math.min(24, 10 + n * 2), steps: ['读取会话轨迹', '诊断过程错误', '生成报告与改进建议'], logs: logs };
    }
    if (task.cap === 'codegraph') {
      var repo = src.path, base = update ? task.input.from : null;
      var head = '[codegraph] 代码版本：分支 ' + src.branch + '，提交 ' + src.commit.sha + '；上次成功的构建或更新：' + (base ? '提交 ' + base : '无记录');
      return update
        ? { seconds: 6, steps: ['自检', '同步代码变化', '校验索引'], logs: [head, '[codegraph] 自检通过：codegraph 1.6.0',
            '[codegraph] 运行：codegraph sync ' + repo, ch && ch.count ? 'Syncing ' + ch.count + ' commits, 14 changed files...' : 'No changes since last sync', 'Resolving refs...', '◆  Synced in 0.6s',
            '[codegraph] 完成：' + repo + ' 的索引已校验通过（sync）'] }
        : { seconds: 9, steps: ['自检', '建立索引', '校验索引'], logs: [head, '[codegraph] 自检通过：codegraph 1.6.0',
            '[codegraph] 运行：codegraph init ' + repo + ' --yes', 'Scanning files...', 'Parsing code...', 'Resolving refs...', 'Linking dynamic dispatch...',
            '◆  Indexed 1,284 files', '●  41,206 nodes, 152,883 edges in 1.4s', '[codegraph] 完成：' + repo + ' 的索引已校验通过（init）'] };
    }
    if (task.cap === 'doc-index') {
      var vNow = App.latestVersion(src);
      var l1 = '[rag] 文档版本：' + App.versionLabel(vNow) + '；上次构建：' + (update ? App.versionLabel(task.input.from) : '无记录');
      return update
        ? { seconds: 7, steps: ['读取文档变化', '更新索引', '校验'], logs: [l1, '[rag] 文档变化：' + (ch.text || '无'),
            '[rag] 切分 ' + (ch.added.length + ch.modified.length) + ' 个文档，生成 ' + (ch.added.length + ch.modified.length) * 46 + ' 个片段',
            '[rag] 计算向量：bge-m3，1,024 维', '[rag] 更新 BM25 倒排索引', ch.removed.length ? '[rag] 移除 ' + ch.removed.length + ' 个已删除文档的片段' : '[rag] 没有需要移除的片段',
            '[rag] 完成：索引校验通过，共 ' + src.files + ' 个文档'] }
        : { seconds: 9, steps: ['读取文档', '构建索引', '校验'], logs: [l1, '[rag] 读取 ' + src.files + ' 个文档', '[rag] 切分并生成 1,146 个片段',
            '[rag] 计算向量：bge-m3，1,024 维', '[rag] 建立 BM25 倒排索引', '[rag] 完成：索引校验通过'] };
    }
    if (task.cap === 'miner-pr' || task.cap === 'miner-diff') {
      var run = '.icode-knowledge/miner/.runs/' + App.hashId(sid, 8);
      var lm = ['• iCode：Code Agent 就绪，会话 ' + sid, '→ skill  icode-' + task.cap, '→ script  icode-' + task.cap + '/scripts/prepare_input.py', '  ✓ 0.1s',
        '准备完成。先读取 PR 资料、模板和分析模板。'];
      (task.prs || []).forEach(function (n) { lm.push('→ read   ' + run + '/input/prs/' + n + '/description.md', '→ read   ' + run + '/input/prs/' + n + '/diff.patch'); });
      if (!task.prs) lm.push('→ read   ' + run + '/input/snippets.md');
      lm.push('→ resource  icode-miner-pr/assets/analyzer_template.md', '需要补充上下文：读取相关服务的领域对象和应用服务。',
        '→ grep   class .*Service in services/', '→ read   services/transaction-service/src/main/java/com/cardcore/transaction/application/PostingService.java',
        '→ write  ' + run + '/analyzer.md', '→ resource  icode-miner-pr/assets/summarizer_template.md', '→ write  ' + run + '/summary.md',
        '→ write  ' + run + '/naming.json', '→ script  icode-' + task.cap + '/scripts/archive_spec.py', '  ✓ 0.1s',
        '✓ Done · 4m 19s · ' + (17 + (task.prs || []).length * 2) + ' tool calls · session ' + sid);
      return { seconds: 14, steps: ['准备输入', '分析代码变更', '总结并归档范式'], logs: lm };
    }
    // doc-extract (Skill)
    var names = task.sources.map(function (id) { var s = App.source(id); return s ? s.name : ''; });
    var le = ['• iCode：Code Agent 就绪，会话 ' + sid, '→ skill  doc-knowledge-extract', '→ script  doc-knowledge-extract/scripts/prepare_input.py', '  ✓ 0.2s'];
    if (update) {
      le.push('读取文档变化（' + App.versionLabel(task.input.from) + ' → ' + App.versionLabel(task.input.to) + '）：' + (ch.text || '无变化'));
      ch.added.concat(ch.modified).forEach(function (f) { le.push('→ read   ' + f); });
      ch.removed.forEach(function (f) { le.push('已删除：' + f + '，标出引用它的知识条目'); });
      var prev = App.existingArtifact(task), outs = prev ? prev.files.filter(function (f) { return !/index\.md$/.test(f); }).map(function (f) { return f.split('/').pop(); }) : [];
      if (src.id === 's-docs') le.push('→ read   上一版 业务规则目录.md', '→ edit   业务规则目录.md：新增 8 条，修订 1 条', '→ edit   统一语言术语表.md：新增 3 个术语');
      else outs.forEach(function (f) { le.push('→ read   上一版 ' + f, '→ edit   ' + f + '：修订受这些文档影响的条目'); });
    } else {
      le.push('读取 ' + names.join('、') + ' 的全部文档', '→ write  业务规则目录.md', '→ write  数据字典.md', '→ write  统一语言术语表.md', '→ write  五层业务模型.md');
    }
    le.push('✓ Done，会话 ' + sid);
    return { seconds: 12, steps: update ? ['读取文档变化', '修订受影响的知识', '整理产物'] : ['读取文档', '提取知识', '整理产物'], logs: le };
  };
  App.startRun = function (task) {
    var src = App.source(task.sources[0]), a = App.existingArtifact(task), basis = a && App.basisOf(a);
    var now = App.sourceState(src);
    var cap = App.cap(task.cap);
    if (task.mode === 'update' && cap.update && basis && now) task.input = { from: basis.version || basis.commit, to: now.version || now.commit };
    else delete task.input;
    task.status = 'running';
    task.run = { startedAt: Date.now(), plan: App.runPlan(task) };
    task.lastRun = App.now();
    App.save();
  };
  App.runProgress = function (task) {
    var r = task.run;
    if (!r) return { pct: 100, step: 99, logs: [] };
    var f = Math.min(1, (Date.now() - r.startedAt) / (r.plan.seconds * 1000));
    var steps = r.plan.steps.length;
    var logCount = Math.max(1, Math.ceil(f * r.plan.logs.length));
    return { pct: Math.round(f * 100), step: Math.min(steps - 1, Math.floor(f * steps)), done: f >= 1, logs: r.plan.logs.slice(0, logCount) };
  };
  App.finishRun = function (task) {
    var r = task.run;
    task.status = 'success';
    task.duration = r ? Math.round(r.plan.seconds) + ' 秒' : task.duration;
    if (r) task.lastLogs = r.plan.logs;
    delete task.run;
    var a = App.produce(task);
    task.artifact = a.id;
    task.produced = a.id;
    App.save();
    return a;
  };
  function trajTopic(ids) {
    var topics = App.state.trajTopics, best = 'posting', bestScore = -1;
    Object.keys(topics).forEach(function (k) {
      var score = 0;
      ids.forEach(function (id) { var s = App.session(id); if (s) topics[k].keywords.forEach(function (w) { if (s.title.indexOf(w) >= 0) score++; }); });
      if (score > bestScore) { best = k; bestScore = score; }
    });
    return best;
  }
  // Indexes are not reviewed after their first publish: each later run publishes itself, and an update that
  // finds no change keeps the current version.
  function autoPublish(a, task) {
    var src = App.source(task.sources[0]), p = a.published;
    var c = task.mode === 'update' && task.input ? App.changesSince(src, src.type === 'docs' ? { version: task.input.from } : { commit: task.input.from }) : null;
    task.unchanged = !!(c && !c.count);
    if (!task.unchanged) {
      a.published = { version: p.version + 1, at: App.now(), delivery: p.delivery, project: p.project, basis: a.draft.basis, auto: true,
        note: c ? (src.type === 'docs' ? '同步文档变化：' : '同步代码变化：') + c.text : '重新构建' };
    }
    a.draft = null;
  }
  function sameSet(x, y) { return x && y && x.length === y.length && x.every(function (v) { return y.indexOf(v) >= 0; }); }
  // Same capability on the same input -> a new draft version of that artifact; different input -> a new artifact.
  App.produce = function (task) {
    var cap = App.cap(task.cap), now = App.now();
    var a = App.existingArtifact(task);
    var draft = { created: now, task: task.id, revisions: [], basis: App.sourceState(App.source(task.sources[0])) };
    if (a) {
      if (a.folder === 'miner' && task.prs) {
        var map = JSON.parse(App.content('miner/pr-map.json') || '{}');
        var base = (a.draft ? a.specs : (a.published && a.published.specs)) || [];
        var add = task.prs.map(function (n) { return map[n]; }).filter(Boolean);
        a.specs = base.concat(add.filter(function (n, i) { return base.indexOf(n) < 0 && add.indexOf(n) === i; }));
        a.files = window.MINER_FILES(a.specs);
      }
      a.draft = draft;
      if (a.kind === 'index' && a.published) autoPublish(a, task);
      return a;
    }
    var src = App.source(task.sources[0]);
    a = { id: App.uid('a'), cap: cap.id, sources: task.sources.slice(), published: null, draft: draft };
    if (task.cap === 'traj') {
      var topic = trajTopic(task.sessions), t = App.state.trajTopics[topic];
      var first = App.session(task.sessions[0]);
      a.name = '会话轨迹诊断：' + (task.sessions.length > 1 ? t.title + '（' + task.sessions.length + ' 个会话）' : first.title);
      a.desc = '经验规则，以及 Skill ' + t.skill + ' 的改进建议。';
      a.sessions = task.sessions.slice(); a.topic = topic; a.kind = 'files'; a.folder = '经验规则';
      a.files = ['trajectory/' + topic + '/轨迹诊断报告.html', 'trajectory/' + topic + '/改进建议.md', 'trajectory/' + topic + '/Skill改进-' + t.skill + '.md'];
      a.skillPatch = t.skill;
    } else if (cap.cat === 'index') {
      a.name = src.name + (cap.id === 'codegraph' ? ' CodeGraph' : ' RAG 检索');
      a.desc = cap.id === 'codegraph' ? '查询 ' + src.name + ' 中的代码定义与调用关系。' : '按问题检索 ' + src.name + ' 中的相关段落。';
      a.kind = 'index';
      a.stats = cap.id === 'codegraph' ? [['文件', '1,068'], ['节点', '33,914'], ['关系', '120,537']] : [['文档', String(src.files || 30)], ['片段', '1,402'], ['向量维度', '1,024']];
      a.mcpName = cap.id === 'codegraph' ? 'codegraph' : 'docs-rag';
    } else if (cap.cat === 'doc') {
      a.name = src.name + ' 业务知识';
      a.desc = '从「' + src.name + '」提取的业务规则、术语和数据字典。';
      a.kind = 'files'; a.folder = '业务知识';
      a.files = ['doc-knowledge/index.md', 'doc-knowledge/业务规则目录.md', 'doc-knowledge/数据字典.md', 'doc-knowledge/统一语言术语表.md', 'doc-knowledge/五层业务模型.md'];
      a.skills = ['cobol-legacy-knowledge', 'bank-domain-payments'];
      a.usage = '涉及业务规则、字段含义、术语或业务流程时先查阅';
    } else {
      var map2 = JSON.parse(App.content('miner/pr-map.json') || '{}');
      a.specs = (task.prs || []).map(function (n) { return map2[n]; }).filter(function (n, i, arr) { return n && arr.indexOf(n) === i; });
      if (!a.specs.length) a.specs = ['跨服务幂等记账'];
      a.name = src.name + ' 开发范式';
      a.desc = '从已合并 PR 总结的实现范式，含步骤、约束和示例代码。';
      a.kind = 'files'; a.folder = 'miner';
      a.files = window.MINER_FILES(a.specs);
      a.skills = ['find-reference-spec'];
      a.usage = '开发新需求或修改现有功能前，用 find-reference-spec 查找可参考的范式';
    }
    App.state.artifacts.unshift(a);
    return a;
  };

  var listeners = [];
  App.onTick = function (fn) { listeners.push(fn); };
  setInterval(function () {
    var finished = [];
    App.state.tasks.forEach(function (t) {
      if (t.status === 'running' && App.runProgress(t).done) finished.push(t);
    });
    finished.forEach(function (t) {
      App.finishRun(t);
      App.toast('任务完成：' + App.taskName(t));
    });
    listeners.forEach(function (fn) { fn(finished.length > 0); });
  }, 700);

  // ---------- Mock "ask iCode to filter sessions" ----------
  // The real product sends the request to iCode; here a few common phrasings are understood locally.
  App.askICode = function (prompt, sessions) {
    var text = prompt.replace(/\s+/g, '');
    var conds = [];
    function cmp(re, field, label, scale) {
      var m = re.exec(text);
      if (!m) return;
      var n = parseFloat(m[2]) * (scale && /万/.test(m[0]) ? 10000 : 1);
      var less = /少于|小于|低于|不到|以下|不超过|<|以内/.test(m[0]);
      conds.push({ test: function (s) { return less ? s[field] < n : s[field] > n; }, text: label + (less ? '少于 ' : '超过 ') + (field === 'tokens' ? App.tokens(n) : App.num(n)) });
    }
    cmp(/(轮次|轮数|轮对话|对话轮|轮)[^0-9]{0,6}?(\d+(?:\.\d+)?)/, 'turns', '对话轮次', false);
    cmp(/(超过|大于|多于|高于|少于|小于|低于|不到|不超过)(\d+(?:\.\d+)?)轮/, 'turns', '对话轮次', false);
    cmp(/(消息)[^0-9]{0,6}?(\d+(?:\.\d+)?)/, 'messages', '消息数', false);
    cmp(/(token|Token|TOKEN)[^0-9]{0,6}?(\d+(?:\.\d+)?)万?/, 'tokens', 'Token 用量', true);
    cmp(/(修改|改动)[^0-9]{0,6}?(\d+(?:\.\d+)?)个?文件/, 'files', '修改文件数', false);
    // Fix the duplicated turn condition when both phrasings match.
    if (conds.length > 1 && conds[0].text.indexOf('对话轮次') === 0 && conds[1].text.indexOf('对话轮次') === 0) conds.splice(1, 1);

    var days = /最近(\d+)天/.exec(text);
    var now = new Date(App.now().replace(' ', 'T'));
    function daysAgo(s) { return (now - new Date(s.updated.replace(' ', 'T'))) / 86400000; }
    if (days) conds.push({ test: function (s) { return daysAgo(s) <= +days[1]; }, text: '最近 ' + days[1] + ' 天内更新' });
    else if (/本周|这周|最近一周|近一周/.test(text)) conds.push({ test: function (s) { return daysAgo(s) <= 7; }, text: '最近 7 天内更新' });
    else if (/今天/.test(text)) conds.push({ test: function (s) { return daysAgo(s) < 1; }, text: '今天更新' });

    if (/legacy|COBOL|cobol|老系统|主机/.test(text)) conds.push({ test: function (s) { return /legacy/.test(s.cwd); }, text: '在 card-core-legacy 中进行' });
    else if (/文档目录|docs/.test(text)) conds.push({ test: function (s) { return /docs/.test(s.cwd); }, text: '在业务文档目录中进行' });
    App.state.team.members.forEach(function (m) {
      if (text.indexOf(m.name) >= 0) conds.push({ test: function (s) { return s.owner === m.id; }, text: '由' + m.name + '共享' });
    });
    if (/问答|Q&A|QA/.test(text)) conds.push({ test: function (s) { return s.agent === 'Q&A Agent'; }, text: '使用 Q&A Agent' });

    var topics = ['营销', '授权', '利息', '入账', '账户', '卡服务', '交易', '测试', '幂等', '乐观锁', '错误码', '还款', '迁移', '性能', '评审', '批处理', '修复', '欺诈', '客户', '报表'];
    var topicHits = topics.filter(function (t) { return text.indexOf(t) >= 0; });
    if (/失败|报错|出错|返工|问题|缺陷|bug/i.test(text)) topicHits.push('问题');
    if (topicHits.length) {
      conds.push({
        test: function (s) {
          return topicHits.some(function (t) {
            if (t === '问题') return /问题|修复|缺陷|排查|失败|冲突/.test(s.title);
            if (t === '修复') return /修复|缺陷/.test(s.title);
            return s.title.indexOf(t) >= 0;
          });
        },
        text: '主题与「' + topicHits.join('、') + '」相关'
      });
    }

    var result, answer;
    if (conds.length) {
      result = sessions.filter(function (s) { return conds.every(function (c) { return c.test(s); }); });
      answer = result.length
        ? '找到 ' + result.length + ' 个符合要求的会话：' + conds.map(function (c) { return c.text; }).join('，') + '。'
        : '没有同时满足这些条件的会话：' + conds.map(function (c) { return c.text; }).join('，') + '。';
    } else {
      // Nothing recognisable: fall back to the sessions most worth diagnosing.
      result = sessions.slice().sort(function (a, b) { return b.turns - a.turns; }).slice(0, 8);
      answer = '按对话轮次和修改规模挑选了 ' + result.length + ' 个最值得诊断的会话。';
    }
    result.sort(function (a, b) { return a.updated < b.updated ? 1 : -1; });
    return { ids: result.map(function (s) { return s.id; }), answer: answer };
  };

  // ---------- Select ----------
  // Keep the native select as the form value and draw a themed popup, as Talents' select.ts does.
  // <select data-search="搜索成员"> adds a search box. Every select on the page is enhanced on insertion.
  var selectSeq = 0, openSelect = null;
  var nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  var nativeIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  App.enhanceSelect = function (select) {
    if (select._kb || select.hasAttribute('data-native')) return;
    select._kb = true;
    var searchable = select.hasAttribute('data-search');
    var id = 'kb-options-' + (++selectSeq);
    var wrapper = document.createElement('span');
    wrapper.className = 'kb-select';
    if (select.style.width) wrapper.style.width = select.style.width;
    wrapper.innerHTML = '<button type="button" class="kb-select-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '">' +
      '<span></span><span class="kb-select-chevron" aria-hidden="true">⌄</span></button>' +
      '<span class="kb-select-options" hidden>' + (searchable ? '<input type="search" class="kb-select-search" autocomplete="off">' : '') +
      '<span class="kb-select-list" role="listbox" id="' + id + '"></span><span class="kb-select-note" role="status" hidden>没有匹配的选项</span></span>';
    var trigger = wrapper.firstChild, text = trigger.firstChild, panel = wrapper.lastChild;
    var search = panel.querySelector('.kb-select-search'), list = panel.querySelector('.kb-select-list'), note = panel.querySelector('.kb-select-note');
    var holder = select.closest('label'), named = holder && holder.querySelector('.label');
    var label = select.getAttribute('aria-label') || (named && named.textContent.trim()) || '选项';
    trigger.setAttribute('aria-label', label); list.setAttribute('aria-label', label);
    if (search) { search.placeholder = select.dataset.search || '搜索'; search.setAttribute('aria-label', search.placeholder); search.setAttribute('aria-controls', id); }
    select.hidden = true;
    select.after(wrapper);
    var active = select.selectedIndex, shown = [], prefix = '', lastKey = 0;

    function sync() {
      var o = select.options[nativeIndex.get.call(select)];
      text.textContent = o ? o.text : '请选择';
      trigger.disabled = select.disabled;
      active = nativeIndex.get.call(select);
      if (!panel.hidden) draw();
    }
    function draw() {
      var q = search ? search.value.trim().toLowerCase() : '', html = '';
      shown = [];
      Array.prototype.forEach.call(select.children, function (node) {
        var group = node.tagName === 'OPTGROUP', rows = '';
        (group ? Array.prototype.slice.call(node.children) : [node]).forEach(function (o) {
          if (q && o.text.toLowerCase().indexOf(q) < 0) return;
          if (!o.disabled) shown.push(o.index);
          rows += '<span class="kb-select-option" role="option" id="' + id + '-' + o.index + '" data-i="' + o.index + '" aria-selected="' + o.selected + '" aria-disabled="' + o.disabled + '">' +
            '<span>' + esc(o.text) + '</span><span class="kb-select-check" aria-hidden="true">' + (o.selected ? '✓' : '') + '</span></span>';
        });
        if (rows && group) html += '<span class="kb-select-group" role="presentation">' + esc(node.label) + '</span>';
        html += rows;
      });
      list.innerHTML = html;
      note.hidden = !!html;
      if (shown.indexOf(active) < 0) active = shown.length ? shown[0] : -1;
      highlight();
    }
    function highlight() {
      var on = null;
      Array.prototype.forEach.call(list.querySelectorAll('.kb-select-option'), function (row) {
        var hit = +row.dataset.i === active;
        row.classList.toggle('is-active', hit);
        if (hit) on = row;
      });
      var owner = search || trigger;
      if (on && !panel.hidden) { owner.setAttribute('aria-activedescendant', on.id); on.scrollIntoView({ block: 'nearest' }); }
      else owner.removeAttribute('aria-activedescendant');
    }
    function place() {
      // Fixed position so drawers and dialogs that scroll do not clip the popup.
      var r = trigger.getBoundingClientRect();
      panel.style.minWidth = r.width + 'px';
      var h = panel.offsetHeight, w = panel.offsetWidth;
      var up = r.bottom + 6 + h > innerHeight && r.top > h + 6;
      panel.style.top = (up ? r.top - 6 - h : r.bottom + 6) + 'px';
      panel.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    }
    function open() {
      if (trigger.disabled) return;
      if (openSelect && openSelect !== api) openSelect.close();
      if (search) search.value = '';
      panel.hidden = false;
      sync(); place();
      trigger.setAttribute('aria-expanded', 'true');
      openSelect = api;
      highlight();
      if (search) search.focus();
    }
    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (openSelect === api) openSelect = null;
    }
    function choose(i) {
      var o = select.options[i];
      if (!o || o.disabled) return;
      var changed = nativeIndex.get.call(select) !== i;
      nativeIndex.set.call(select, i);
      close(); sync();
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      trigger.focus();
    }
    function move(key) {
      var at = shown.indexOf(active), n = shown.length;
      if (!n) return;
      active = key === 'Home' ? shown[0] : key === 'End' ? shown[n - 1] : shown[(at + (key === 'ArrowUp' ? -1 : 1) + n) % n];
      highlight();
    }
    var api = { wrapper: wrapper, close: close, place: place };

    list.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      var row = e.target.closest('.kb-select-option');
      if (row) { e.stopPropagation(); choose(+row.dataset.i); }
    });
    trigger.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (panel.hidden) open(); else close(); });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { close(); return; }
      if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (panel.hidden) open(); else choose(active); return; }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) >= 0) {
        e.preventDefault();
        if (panel.hidden) { open(); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') return; }
        move(e.key); return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !search) {
        e.preventDefault();
        if (panel.hidden) open();
        prefix = Date.now() - lastKey > 700 ? e.key : prefix + e.key; lastKey = Date.now();
        var hit = shown.filter(function (i) { return select.options[i].text.toLowerCase().indexOf(prefix.toLowerCase()) === 0; })[0];
        if (hit != null) { active = hit; highlight(); }
      }
    });
    if (search) {
      search.addEventListener('input', function () { active = -1; draw(); place(); });
      search.addEventListener('keydown', function (e) {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); trigger.focus(); }
        else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); move(e.key); }
      });
    }
    wrapper.addEventListener('focusout', function (e) { if (!wrapper.contains(e.relatedTarget)) close(); });
    select.addEventListener('change', sync);
    // Code that sets select.value / selectedIndex or replaces the options keeps the trigger in step.
    Object.defineProperty(select, 'value', { configurable: true, get: function () { return nativeValue.get.call(select); }, set: function (v) { nativeValue.set.call(select, v); sync(); } });
    Object.defineProperty(select, 'selectedIndex', { configurable: true, get: function () { return nativeIndex.get.call(select); }, set: function (v) { nativeIndex.set.call(select, v); sync(); } });
    new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    sync();
  };
  document.addEventListener('pointerdown', function (e) {
    if (openSelect && !openSelect.wrapper.contains(e.target)) openSelect.close();
  });
  window.addEventListener('scroll', function (e) {
    if (!openSelect) return;
    if (!openSelect.wrapper.isConnected) { openSelect = null; return; }
    if (!openSelect.wrapper.contains(e.target)) openSelect.place();
  }, true);
  window.addEventListener('resize', function () { if (openSelect) openSelect.close(); });
  function enhanceIn(node) {
    if (node.nodeType !== 1) return;
    if (node.tagName === 'SELECT') App.enhanceSelect(node);
    else node.querySelectorAll('select').forEach(App.enhanceSelect);
  }
  enhanceIn(document.body);
  new MutationObserver(function (records) {
    records.forEach(function (r) { r.addedNodes.forEach(enhanceIn); });
  }).observe(document.body, { childList: true, subtree: true });

  return App;
})();
