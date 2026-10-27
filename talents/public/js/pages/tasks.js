// 知识任务：任务列表、新建任务（来源在单独的选择弹窗中选），运行进度与产出。
(function () {
  var A = App, esc = A.esc;

  function resultBadge(t) {
    if (t.status === 'running') return '<span class="badge primary">运行中</span>';
    if (!t.lastRun) return '<span class="badge">未运行</span>';
    if (t.status === 'failed') return '<span class="badge danger">失败</span>';
    return '<span class="badge success">成功</span>';
  }
  function sourceText(t) {
    if (t.sessions) return t.sessions.length + ' 个团队会话';
    var names = t.sources.map(function (id) { var s = A.source(id); return s ? s.name : '已移除的来源'; }).join('、');
    if (t.prs) names += '，' + t.prs.length + ' 个 PR';
    return names;
  }
  function scheduleText(t) {
    if (t.schedule.kind === 'daily') return t.cap === 'traj' ? '每天 ' + t.schedule.time + ' 分析新共享的会话' : '每天 ' + t.schedule.time + (t.skipUnchanged ? '，来源没有变化时跳过' : '');
    if (t.schedule.kind === 'once') return '定于 ' + t.schedule.at.replace('T', ' ');
    return '一次性';
  }
  function progressBlock(t) {
    var p = A.runProgress(t);
    return '<div data-progress="' + t.id + '"><div class="progress"><i style="width:' + p.pct + '%"></i></div>' +
      '<p class="caption" style="margin-top:6px">' + esc(t.run.plan.steps[p.step]) + '…</p></div>';
  }
  var view = { tab: 'current', cat: 'all' };
  function isHistory(t) { return t.status !== 'running' && t.schedule.kind !== 'daily' && !!t.lastRun; }
  function nextRun(t) {
    if (t.status === 'running') return '';
    if (t.schedule.kind === 'daily') {
      var now = A.now();
      return (now.slice(11) < t.schedule.time ? '今天 ' : '明天 ') + t.schedule.time;
    }
    if (t.schedule.kind === 'once') return t.schedule.at.replace('T', ' ').slice(5);
    return '';
  }
  function producedLine(t) {
    var id = t.produced || t.artifact, a = id && A.artifact(id);
    if (!a) return '';
    var st = a.draft ? '待审阅' : '已发布 v' + a.published.version;
    return '<dt>产出</dt><dd><a href="#" data-action="goto-review" data-id="' + a.id + '">' + esc(a.name) + '</a>（' + st + '）</dd>';
  }
  function card(t) {
    var cap = A.cap(t.cap), running = t.status === 'running', hist = isHistory(t);
    var fields = '<dt>来源</dt><dd>' + esc(sourceText(t)) + '</dd>';
    if (hist) fields += '<dt>运行于</dt><dd>' + esc(A.when(t.lastRun)) + (t.duration ? '，用时 ' + esc(t.duration) : '') + '</dd>' + producedLine(t);
    else {
      fields += '<dt>时间</dt><dd>' + esc(scheduleText(t)) + '</dd>';
      if (!running && nextRun(t)) fields += '<dt>下次运行</dt><dd>' + esc(nextRun(t)) + '</dd>';
      if (!running && t.lastRun) fields += '<dt>最近运行</dt><dd>' + esc(A.when(t.lastRun)) + '</dd>' + producedLine(t);
    }
    return '<article class="card clickable cat-' + cap.cat + '" data-action="open-task" data-id="' + t.id + '">' +
      '<div class="card-head"><span class="icon">' + A.capIcon(cap) + '</span><div class="grow"><h3>' + esc(A.taskName(t)) + '</h3></div>' + resultBadge(t) + '</div>' +
      '<dl class="fields">' + fields + '</dl>' + (running ? progressBlock(t) : '') +
      (running ? '' : '<div class="card-foot"><span></span><div class="actions"><button data-action="run-task" data-id="' + t.id + '">' + (hist ? '再次运行' : '立即运行') + '</button></div></div>') +
      '</article>';
  }
  function render() {
    var tasks = A.state.tasks.filter(function (t) { return view.cat === 'all' || A.cap(t.cap).cat === view.cat; });
    var current = tasks.filter(function (t) { return !isHistory(t); }).sort(function (a, b) {
      if ((a.status === 'running') !== (b.status === 'running')) return a.status === 'running' ? -1 : 1;
      return (a.created || '') < (b.created || '') ? 1 : -1;
    });
    var history = tasks.filter(isHistory).sort(function (a, b) { return (a.lastRun || '') < (b.lastRun || '') ? 1 : -1; });
    var allCurrent = A.state.tasks.filter(function (t) { return !isHistory(t); }).length;
    var allHistory = A.state.tasks.length - allCurrent;
    var list = view.tab === 'current' ? current : history;
    var chips = [{ id: 'all', name: '全部能力' }].concat(A.state.categories).map(function (c) {
      return '<button class="chip" aria-pressed="' + (view.cat === c.id) + '" data-action="task-cat" data-id="' + c.id + '">' + esc(c.name) + '</button>';
    }).join('');
    return '<header class="page-heading"><div><h1>知识任务</h1><p class="ui-note">选择能力和来源，用本机 iCode 生成知识。产出会进入“产物审阅”，审阅后再发布给团队；已发布的索引，之后的更新自动发布。</p></div>' +
      '<div class="actions"><button class="primary" data-action="new-task">＋ 新建任务</button></div></header>' +
      '<div class="toolbar"><div class="tabs" role="tablist"><button aria-pressed="' + (view.tab === 'current') + '" data-action="task-tab" data-id="current">当前任务（' + allCurrent + '）</button>' +
      '<button aria-pressed="' + (view.tab === 'history') + '" data-action="task-tab" data-id="history">历史（' + allHistory + '）</button></div>' +
      '<span class="spacer"></span><div class="chips">' + chips + '</div></div>' +
      (list.length ? '<div class="grid">' + list.map(card).join('') + '</div>'
        : '<div class="empty">' + (view.tab === 'current' ? '没有运行中或等待运行的任务' : '没有历史任务') + '</div>');
  }
  A.actions['task-tab'] = function (el) { view.tab = el.dataset.id; A.refresh(); };
  A.actions['task-cat'] = function (el) { view.cat = el.dataset.id; A.refresh(); };
  function mount(container, params) {
    if (params.new) { history.replaceState(null, '', '#/tasks'); A.route.params = {}; openForm({ cap: params.cap, source: params.source, from: params.from }); }
    else if (params.open) { history.replaceState(null, '', '#/tasks'); A.route.params = {}; openDetail(params.open); }
  }

  A.onTick(function (finished) {
    if (A.route.page !== 'tasks') return;
    if (finished) { A.refresh(); return; }
    document.querySelectorAll('[data-progress]').forEach(function (node) {
      var t = A.task(node.dataset.progress);
      if (!t || !t.run) return;
      var p = A.runProgress(t);
      node.querySelector('i').style.width = p.pct + '%';
      node.querySelector('.caption').textContent = t.run.plan.steps[p.step] + '…';
    });
  });
  A.actions['run-task'] = function (el) { A.startRun(A.task(el.dataset.id)); view.tab = 'current'; A.refresh(); A.toast('已开始运行'); };
  A.actions['goto-review'] = function (el) { A.closeAll(); A.go('#/review?id=' + el.dataset.id); };

  function modeText(t) {
    if (t.mode !== 'update') return '构建';
    if (!t.input) return '更新现有知识';
    var src = A.source(t.sources[0]);
    return src && src.type === 'docs' ? '更新，' + A.versionLabel(t.input.from) + ' → ' + A.versionLabel(t.input.to)
      : '更新，提交 ' + t.input.from + ' → ' + t.input.to;
  }

  // ---------- Detail ----------
  function openDetail(id) {
    var t = A.task(id);
    if (!t) return;
    var cap = A.cap(t.cap);
    var d = A.drawer({ eyebrow: esc(cap.name), title: esc(A.taskName(t)), body: '<div class="form-body" data-detail></div>', foot: '<span data-foot class="actions" style="width:100%;justify-content:flex-end"></span>' });
    function draw() {
      if (d.closed) return;
      var running = t.status === 'running';
      var p = running ? A.runProgress(t) : null;
      var a = (t.produced || t.artifact) && A.artifact(t.produced || t.artifact);
      var sessionsList = t.sessions ? '<details class="more"><summary>查看会话</summary><ul style="margin:0;padding-left:18px">' +
        t.sessions.map(function (sid) { var s = A.session(sid); return '<li>' + esc(s ? s.title : sid) + '</li>'; }).join('') + '</ul></details>' : '';
      d.body.querySelector('[data-detail]').innerHTML =
        '<dl class="fields"><dt>能力</dt><dd>' + esc(cap.name) + '</dd><dt>来源</dt><dd>' + esc(sourceText(t)) + sessionsList + '</dd>' +
        (t.prs ? '<dt>PR</dt><dd>' + t.prs.map(function (n) { return '#' + n; }).join('、') + '</dd>' : '') +
        (cap.update ? '<dt>方式</dt><dd>' + esc(modeText(t)) + '</dd>' : '') +
        '<dt>时间</dt><dd>' + esc(scheduleText(t)) + '</dd><dt>状态</dt><dd>' + resultBadge(t) + '</dd></dl>' +
        (running
          ? '<div class="field"><span class="label">进度</span><div class="progress"><i style="width:' + p.pct + '%"></i></div>' +
            '<ul class="steps" style="margin-top:8px">' + t.run.plan.steps.map(function (s, i) { return '<li class="' + (i < p.step ? 'done' : i === p.step ? 'active' : 'todo') + '"><span class="dot">✓</span>' + esc(s) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="field"><span class="label">日志</span><pre class="log">' + esc(p.logs.join('\n')) + '</pre></div>'
          : (a ? '<div class="produced"><div class="caption">本次产出</div><b>' + esc(a.name) + '</b><span>' + (!a.draft ? (t.unchanged ? '来源没有变化，保持 v' + a.published.version : (a.published.auto ? '已自动发布 v' : '已发布 v') + a.published.version) : a.published ? '原产物的新版本，等待审阅后发布' : '新产物，等待审阅后发布') + '</span></div>' : '') +
            '<div class="field"><span class="label">最近一次运行</span><p>' + esc(t.lastRun || '尚未运行') + (t.duration ? '，用时 ' + esc(t.duration) : '') + '</p></div>' +
            (t.lastRun ? '<details class="more"><summary>日志</summary><pre class="log">' + esc((t.lastLogs || A.runPlan(t).logs).join('\n')) + '</pre></details>' : ''));
      d.el.querySelector('[data-foot]').innerHTML = running ? '<span class="ui-note">可以关闭此面板，任务会继续运行。</span>'
        : '<button data-rerun>立即运行</button>' + (a && a.draft ? '<button class="primary" data-action="goto-review" data-id="' + a.id + '">去审阅</button>' : '');
      var rerun = d.el.querySelector('[data-rerun]');
      if (rerun) rerun.onclick = function () { A.startRun(t); A.refresh(); draw(); };
      var log = d.body.querySelector('.log');
      if (log) log.scrollTop = log.scrollHeight;
    }
    var wasRunning = t.status === 'running';
    A.onTick(function () {
      if (d.closed) return;
      if (t.status === 'running' || wasRunning) { draw(); wasRunning = t.status === 'running'; }
    });
    draw();
  }
  A.actions['open-task'] = function (el) { openDetail(el.dataset.id); };

  // ---------- Selection dialogs ----------
  function pickSessions(initial, done) {
    var selected = new Set(initial);
    var st = { q: '', member: 'all', ai: null, busy: false };
    // Example requests follow the Teams data: a member who shared sessions, other than the person viewing.
    var sharer = A.state.team.members.filter(function (m) { return m.id !== A.state.team.admin && A.teamSessions().some(function (s) { return s.owner === m.id; }); })[1];
    var examples = ['对话轮次超过 50 的会话', '最近 7 天返现相关的会话'].concat(sharer ? [sharer.name + '共享的会话'] : []);
    var d = A.dialog({
      className: 'large', title: '选择会话',
      body: '<div class="form-body session-picker">' +
        '<div class="ai-box"><div class="ai-title">✦ 让 iCode 帮你筛选</div>' +
        '<div class="ai-row"><input data-ai placeholder="用一句话描述要找的会话"><button class="primary" data-ai-go>筛选</button></div>' +
        '<div class="ai-examples"><span class="caption">试试：</span>' + examples.map(function (x) { return '<button data-example="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></div>' +
        '<div data-answer></div>' +
        '<div class="picker-search"><select data-member data-search="搜索成员" aria-label="成员" style="width:140px"><option value="all">全部成员</option>' + A.state.team.members.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + '</option>'; }).join('') + '</select>' +
        '<input type="search" data-q placeholder="搜索会话名称或 ID"></div>' +
        '<div class="table-wrap picker-table"><table class="data"><thead><tr><th style="width:34px"><input type="checkbox" data-all aria-label="全选"></th><th>名称</th><th>成员</th><th>最后更新</th><th class="num">对话轮次</th><th class="num">消息</th><th class="num">Token</th></tr></thead><tbody data-rows></tbody></table></div></div>',
      foot: '<span class="ui-note">已选 <b data-count>0</b> 个会话</span><button class="link" data-clear>清空</button><button data-cancel>取消</button><button class="primary" data-ok>确定</button>'
    });
    var host = d.el;
    d.body.style.display = 'flex';
    function visible() {
      var base = st.ai ? st.ai.ids.map(A.session) : A.teamSessions();
      var q = st.q.trim().toLowerCase();
      return base.filter(function (s) { return (st.member === 'all' || s.owner === st.member) && (!q || s.title.toLowerCase().indexOf(q) >= 0 || s.id.indexOf(q) >= 0); });
    }
    function draw() {
      var rows = host.querySelector('[data-rows]'), answer = host.querySelector('[data-answer]');
      if (st.busy) {
        answer.innerHTML = '';
        rows.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:36px" class="ui-note"><span class="badge primary">iCode</span> 正在筛选会话…</td></tr>';
      } else {
        answer.innerHTML = st.ai ? '<div class="info ai-answer"><span class="who">iCode：</span><span>' + esc(st.ai.answer) + '</span><span style="flex:1"></span>' +
          (st.ai.ids.length ? '<button data-pick-all>全部选中</button>' : '') + '<button class="link" data-reset>显示全部会话</button></div>' : '';
        var list = visible();
        rows.innerHTML = list.map(function (s) {
          var on = selected.has(s.id);
          return '<tr class="row-click' + (on ? ' selected' : '') + '" data-id="' + s.id + '"><td><input type="checkbox"' + (on ? ' checked' : '') + ' aria-label="选择"></td>' +
            '<td class="title-cell">' + esc(s.title) + '</td><td class="nowrap">' + esc(A.memberName(s.owner, s.ownerName)) + '</td><td class="nowrap">' + esc(A.when(s.updated)) + '</td>' +
            '<td class="num">' + s.turns + '</td><td class="num">' + s.messages + '</td><td class="num">' + A.tokens(s.tokens) + '</td></tr>';
        }).join('') || '<tr><td colspan="7" style="text-align:center;padding:28px" class="ui-note">没有匹配的会话</td></tr>';
        var all = host.querySelector('[data-all]');
        all.checked = list.length > 0 && list.every(function (s) { return selected.has(s.id); });
        all.indeterminate = !all.checked && list.some(function (s) { return selected.has(s.id); });
      }
      host.querySelector('[data-count]').textContent = selected.size;
      host.querySelector('[data-ok]').disabled = !selected.size;
    }
    function ask(text) {
      text = (text || '').trim(); if (!text) return;
      st.busy = true; st.q = ''; st.member = 'all';
      host.querySelector('[data-q]').value = ''; host.querySelector('[data-member]').value = 'all';
      var btn = host.querySelector('[data-ai-go]');
      btn.classList.add('busy'); btn.disabled = true; btn.textContent = '筛选中';
      draw();
      setTimeout(function () {
        st.busy = false; st.ai = A.askICode(text, A.teamSessions());
        btn.classList.remove('busy'); btn.disabled = false; btn.textContent = '筛选';
        draw();
        host.querySelector('[data-answer]').scrollIntoView({ block: 'nearest' });
      }, 1400 + Math.random() * 800);
    }
    host.querySelector('[data-ai-go]').onclick = function () { ask(host.querySelector('[data-ai]').value); };
    host.querySelector('[data-ai]').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ask(this.value); } });
    host.querySelector('[data-q]').addEventListener('input', function (e) { st.q = e.target.value; draw(); });
    host.querySelector('[data-member]').onchange = function () { st.member = this.value; draw(); };
    host.querySelector('[data-cancel]').onclick = function () { d.close(); };
    host.querySelector('[data-ok]').onclick = function () { d.close(); done(A.state.sessions.filter(function (s) { return selected.has(s.id); }).map(function (s) { return s.id; })); };
    host.addEventListener('click', function (e) {
      var ex = e.target.closest('[data-example]');
      if (ex) { host.querySelector('[data-ai]').value = ex.dataset.example; ask(ex.dataset.example); return; }
      if (e.target.closest('[data-reset]')) { st.ai = null; draw(); return; }
      if (e.target.closest('[data-pick-all]')) { st.ai.ids.forEach(function (id) { selected.add(id); }); draw(); return; }
      if (e.target.closest('[data-clear]')) { selected.clear(); draw(); return; }
      if (e.target.matches('[data-all]')) { var on = e.target.checked; visible().forEach(function (s) { if (on) selected.add(s.id); else selected.delete(s.id); }); draw(); return; }
      var tr = e.target.closest('tr[data-id]');
      if (tr) { if (selected.has(tr.dataset.id)) selected.delete(tr.dataset.id); else selected.add(tr.dataset.id); draw(); }
    });
    draw();
  }
  function pickPrs(repoId, initial, done) {
    var selected = new Set(initial), q = '';
    var d = A.dialog({
      title: '选择 PR',
      body: '<div class="form-body"><input type="search" data-q placeholder="按编号或标题搜索"><div class="table-wrap" style="max-height:min(420px,55vh)"><table class="data"><tbody data-rows></tbody></table></div></div>',
      foot: '<span class="ui-note">已选 <b data-count>0</b> 个 PR</span><button data-cancel>取消</button><button class="primary" data-ok>确定</button>'
    });
    function draw() {
      var list = (A.state.prs[repoId] || []).slice().reverse().filter(function (p) { var s = q.replace(/^#/, ''); return !s || String(p.number).indexOf(s) === 0 || p.title.toLowerCase().indexOf(s) >= 0; });
      d.el.querySelector('[data-rows]').innerHTML = list.map(function (p) {
        var on = selected.has(p.number);
        return '<tr class="row-click' + (on ? ' selected' : '') + '" data-n="' + p.number + '"><td style="width:34px"><input type="checkbox"' + (on ? ' checked' : '') + '></td><td class="nowrap"><b>#' + p.number + '</b></td><td>' + esc(p.title) + '</td><td class="caption nowrap">' + p.merged + '</td></tr>';
      }).join('') || '<tr><td class="ui-note" style="padding:16px">没有匹配的 PR</td></tr>';
      d.el.querySelector('[data-count]').textContent = selected.size;
      d.el.querySelector('[data-ok]').disabled = !selected.size;
    }
    d.el.querySelector('[data-q]').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); draw(); });
    d.el.querySelector('[data-rows]').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-n]'); if (!tr) return;
      var n = +tr.dataset.n; if (selected.has(n)) selected.delete(n); else selected.add(n); draw();
    });
    d.el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    d.el.querySelector('[data-ok]').onclick = function () { d.close(); done(Array.from(selected).sort(function (a, b) { return a - b; })); };
    draw();
  }

  // ---------- Form ----------
  function openForm(preset) {
    preset = preset || {};
    // "重新提取" on an artifact: start from the task that built it.
    var fromArtifact = preset.from && A.artifact(preset.from);
    var fromTask = fromArtifact && A.state.tasks.filter(function (t) { return (t.produced || t.artifact) === fromArtifact.id; })[0];
    if (fromArtifact) { preset.cap = fromArtifact.cap; preset.source = fromArtifact.sources[0]; }
    var presetSource = preset.source && A.source(preset.source);
    var f = {
      cap: preset.cap || (presetSource ? (presetSource.type === 'repo' ? 'miner-pr' : 'doc-extract') : 'traj'),
      source: preset.source || null, prs: [], sessions: [], schedule: 'now', mode: 'update'
    };
    var capOptions = A.state.categories.map(function (cat) {
      return '<optgroup label="' + esc(cat.name) + '">' + A.state.capabilities.filter(function (c) { return c.cat === cat.id; })
        .map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    var d = A.drawer({
      title: '新建任务',
      body: '<div class="form-body">' +
        '<label class="field"><span class="label">能力</span><select data-cap>' + capOptions + '</select><span class="caption" data-cap-desc></span></label>' +
        '<div class="field"><span class="label">来源</span><div data-sources></div></div>' +
        '<div class="field" data-mode-field hidden><span class="label">方式</span><div class="option-list" data-modes></div></div>' +
        '<div class="field"><span class="label">时间</span><select data-when><option value="now">立即执行</option><option value="once">指定时间执行一次</option><option value="daily">每天定时</option></select>' +
        '<input type="datetime-local" data-at hidden><input type="time" data-time value="02:00" hidden><span class="caption" data-when-note></span>' +
        '<label class="check" data-skip-field hidden><input type="checkbox" data-skip checked> 来源没有变化时跳过</label></div>' +
        '<label class="field"><span class="label">名称 <span class="caption">可选</span></span><input data-name></label>' +
        '<details class="more" data-adv><summary>高级设置</summary><div class="form-body" style="padding:0">' +
        '<label class="field"><span class="label">执行任务的智能体</span><select data-agent>' + A.state.agents.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span class="label">提示词</span><textarea rows="3" data-prompt></textarea></label></div></details>' +
        '</div>',
      foot: '<span class="ui-note" data-hint></span><button data-cancel>取消</button><button class="primary" data-ok>创建并运行</button>'
    });
    var el = d.el;
    el.querySelector('[data-cap]').value = f.cap;
    function summaryRow(text, btnLabel, empty) {
      return '<div class="pick-summary' + (empty ? ' empty' : '') + '"><span>' + esc(text) + '</span><button data-pick>' + btnLabel + '</button></div>';
    }
    function drawSources() {
      var cap = A.cap(f.cap), host = el.querySelector('[data-sources]');
      el.querySelector('[data-cap-desc]').textContent = cap.desc;
      el.querySelector('[data-adv]').hidden = !cap.skill;
      el.querySelector('[data-prompt]').value = cap.prompt || '';
      if (cap.input === 'sessions') {
        f.source = 's-sessions';
        host.innerHTML = summaryRow(f.sessions.length ? '已选 ' + f.sessions.length + ' 个会话' : '还没有选择会话', f.sessions.length ? '重新选择' : '选择会话…', !f.sessions.length);
        host.querySelector('[data-pick]').onclick = function () { pickSessions(f.sessions, function (ids) { f.sessions = ids; drawSources(); validate(); }); };
        return;
      }
      var repos = A.state.sources.filter(function (s) { return s.type === 'repo'; });
      var pool = cap.input === 'docs' ? A.state.sources.filter(function (s) { return s.type === 'docs'; }) : repos;
      if (cap.input === 'repo+pr') pool = repos.filter(function (s) { return s.prs; });
      if (!f.source || !pool.some(function (s) { return s.id === f.source; })) {
        // Prefer a source of the project the user came for.
        var focus = A.focusProject && A.project(A.focusProject);
        var pick = pool.filter(function (s) { return focus && focus.sourceIds.indexOf(s.id) >= 0; })[0] || pool[0];
        f.source = pick && pick.id;
      }
      var html = '<select data-src>' + pool.map(function (s) { return '<option value="' + s.id + '"' + (s.id === f.source ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select>';
      if (cap.input === 'repo+pr') html += summaryRow(f.prs.length ? '已选 ' + f.prs.length + ' 个 PR：' + f.prs.map(function (n) { return '#' + n; }).join('、') : '还没有选择 PR', f.prs.length ? '重新选择' : '选择 PR…', !f.prs.length);
      if (cap.input === 'repo+snippet') html += '<input data-scenario placeholder="场景，例如：账户余额更新"><textarea rows="2" data-snippets placeholder="代码片段文件，每行一个路径"></textarea>';
      host.innerHTML = '<div class="stack">' + html + '</div>';
      host.querySelector('[data-src]').onchange = function () { f.source = this.value; f.prs = []; drawSources(); drawMode(); validate(); };
      var pick = host.querySelector('[data-pick]');
      if (pick) pick.onclick = function () { pickPrs(f.source, f.prs, function (list) { f.prs = list; drawSources(); validate(); }); };
      host.querySelectorAll('[data-scenario],[data-snippets]').forEach(function (i) { i.addEventListener('input', validate); });
    }
    // Update vs rebuild: only when the capability declares an update and this input already has knowledge.
    function modeInfo() {
      var cap = A.cap(f.cap);
      if (!cap.update || !f.source || cap.input === 'sessions') return null;
      var a = A.existingArtifact({ cap: f.cap, sources: [f.source] });
      var basis = a && A.basisOf(a);
      if (!basis) return null;
      return { artifact: a, changes: A.changesSince(A.source(f.source), basis) };
    }
    function drawMode() {
      var info = modeInfo(), field = el.querySelector('[data-mode-field]');
      field.hidden = !info;
      if (!info) return;
      var c = info.changes, src = A.source(f.source);
      var what = src.type === 'docs' ? '文档' : '代码';
      var note = c && c.count ? '上次' + (src.type === 'docs' ? '提取' : '构建') + '后' + what + '有变化：' + (src.type === 'docs' ? A.versionLabel(c.from) + ' → ' + A.versionLabel(c.to) + '，' : '') + c.text
        : '上次' + (src.type === 'docs' ? '提取' : '构建') + '后' + what + '没有变化';
      el.querySelector('[data-modes]').innerHTML =
        '<label class="option"><input type="radio" name="mode" value="update"' + (f.mode === 'update' ? ' checked' : '') + '><span><b>更新现有知识</b><span class="caption">' + esc(note) + '</span></span></label>' +
        '<label class="option"><input type="radio" name="mode" value="build"' + (f.mode === 'build' ? ' checked' : '') + '><span><b>重新构建</b><span class="caption">全部重新处理，生成「' + esc(info.artifact.name) + '」的新版本</span></span></label>';
      el.querySelectorAll('input[name=mode]').forEach(function (r) { r.onchange = function () { f.mode = r.value; validate(); }; });
    }
    function validate() {
      var cap = A.cap(f.cap), ok = !!f.source, hint = '';
      var info = modeInfo();
      if (info && f.mode === 'update' && f.schedule !== 'daily' && info.changes && !info.changes.count) { ok = false; hint = '来源没有变化，无需更新'; }
      if (cap.input === 'sessions') { ok = f.sessions.length > 0; hint = ok ? '' : '请选择会话'; }
      if (cap.input === 'repo+pr') { ok = ok && f.prs.length > 0; hint = ok ? '' : '请选择 PR'; }
      if (cap.input === 'repo+snippet') { ok = ok && el.querySelector('[data-scenario]').value.trim() && el.querySelector('[data-snippets]').value.trim(); hint = ok ? '' : '请填写场景和代码片段'; }
      el.querySelector('[data-hint]').textContent = hint;
      el.querySelector('[data-ok]').disabled = !ok;
      el.querySelector('[data-ok]').textContent = f.schedule === 'now' ? '创建并运行' : '创建';
      el.querySelector('[data-when-note]').textContent = f.schedule === 'daily' && cap.input === 'sessions' ? '每天分析新共享的会话；首次运行分析上面选择的会话。' : '';
      el.querySelector('[data-skip-field]').hidden = !(f.schedule === 'daily' && cap.input !== 'sessions');
      el.querySelector('[data-name]').placeholder = A.taskName({ cap: f.cap, sources: f.source ? [f.source] : [], sessions: cap.input === 'sessions' ? f.sessions : null });
    }
    el.querySelector('[data-cap]').onchange = function () { f.cap = this.value; f.prs = []; drawSources(); drawMode(); validate(); };
    el.querySelector('[data-when]').onchange = function () {
      f.schedule = this.value;
      el.querySelector('[data-at]').hidden = f.schedule !== 'once';
      el.querySelector('[data-time]').hidden = f.schedule !== 'daily';
      validate();
    };
    el.querySelector('[data-at]').value = new Date(Date.now() + 86400000).toISOString().slice(0, 10) + 'T09:00';
    el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    el.querySelector('[data-ok]').onclick = function () {
      var cap = A.cap(f.cap);
      var t = {
        id: A.uid('t'), name: el.querySelector('[data-name]').value.trim(), cap: f.cap, sources: [f.source], created: A.now(), status: 'idle',
        mode: modeInfo() ? f.mode : 'build', prompt: cap.skill ? el.querySelector('[data-prompt]').value : undefined,
        schedule: f.schedule === 'daily' ? { kind: 'daily', time: el.querySelector('[data-time]').value || '02:00' }
          : f.schedule === 'once' ? { kind: 'once', at: el.querySelector('[data-at]').value } : { kind: 'now' }
      };
      if (cap.input === 'sessions') t.sessions = f.sessions.slice();
      if (cap.input === 'repo+pr') t.prs = f.prs.slice();
      if (t.schedule.kind === 'daily' && cap.input !== 'sessions') t.skipUnchanged = el.querySelector('[data-skip]').checked;
      A.state.tasks.unshift(t);
      if (f.schedule === 'now') A.startRun(t); else A.save();
      view.tab = 'current';
      d.close(); A.refresh();
      if (f.schedule === 'now') openDetail(t.id); else A.toast('已创建任务');
    };
    drawSources(); drawMode();
    if (fromTask && fromTask.prompt) el.querySelector('[data-prompt]').value = fromTask.prompt;
    if (fromTask && fromTask.agent) el.querySelector('[data-agent]').value = fromTask.agent;
    validate();
  }
  A.actions['new-task'] = function () { openForm({}); };

  A.pages.tasks = { title: '知识任务', role: 'admin', render: render, mount: mount };
})();
