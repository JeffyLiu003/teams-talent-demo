// 开发者端 · 项目知识：团队已发布的知识，一键应用、更新。
(function () {
  var A = App, esc = A.esc;
  var view = { project: null };

  function joined() { return A.state.projects; }
  function visible(pid) {
    return A.state.artifacts.filter(function (a) { return a.published && a.published.project === pid; });
  }
  function state(a) {
    var ap = A.state.dev.applied[a.id];
    if (!ap) return 'none';
    // Indexes are queried online, so an applied index always serves the latest version.
    if (K.isIndex(a)) return 'applied';
    return ap.version < a.published.version ? 'update' : 'applied';
  }
  function card(a) {
    var st = state(a), ap = A.state.dev.applied[a.id], cap = A.cap(a.cap);
    var badge = st === 'none' ? '<span class="badge">未应用</span>' : st === 'update' ? '<span class="badge warning">有更新</span>' : '<span class="badge success">已应用</span>';
    var main = st === 'none' ? '<button class="primary" data-action="dev-apply" data-id="' + a.id + '">应用</button>'
      : st === 'update' ? '<button class="primary" data-action="dev-update" data-id="' + a.id + '">更新</button>' : '';
    return '<article class="card cat-' + cap.cat + '" data-artifact="' + a.id + '">' +
      '<div class="card-head"><span class="icon">' + A.capIcon(cap) + '</span><div class="grow"><h3>' + esc(a.name) + '</h3></div>' + badge + '</div>' +
      '<p class="ui-note">' + esc(a.desc) + '</p>' +
      (st === 'update' ? '<div class="update-note"><span class="caption">更新说明</span>' + esc(a.published.note) + '</div>' : '') +
      '<div class="card-foot"><span class="caption">' + (ap ? '范围：' + esc(K.scopeText(ap.scope)) + ' <a href="#" data-action="dev-changes" data-id="' + a.id + '">查看改动</a>' : '') + '</span>' +
      '<div class="actions"><button class="link" data-action="dev-preview" data-id="' + a.id + '">预览</button>' + main +
      (ap ? '<button class="icon-button" data-action="dev-menu" data-id="' + a.id + '" aria-label="更多">⋯</button>' : '') + '</div></div></article>';
  }
  function render(params) {
    // ?project= (e.g. from a Teams link) picks the project; otherwise keep the last one shown.
    if (params.project && A.project(params.project)) view.project = params.project;
    if (!A.project(view.project)) view.project = (A.focusProject && A.project(A.focusProject) ? A.focusProject : (joined()[0] || {}).id) || null;
    if (!view.project) return '<header class="page-heading"><div><h1>项目知识</h1></div></header><div class="empty"><b>还没有加入项目</b><span>在 iCode Teams 中加入项目后，这里会显示团队发布的知识。</span></div>';
    var list = visible(view.project);
    var pending = list.filter(function (a) { return state(a) === 'none'; }).length;
    var updates = list.filter(function (a) { return state(a) === 'update'; }).length;
    var tabs = '<div class="tabs" role="group" aria-label="项目">' + joined().map(function (p) {
      return '<button aria-pressed="' + (p.id === view.project) + '" data-action="dev-project" data-id="' + esc(p.id) + '">' + esc(p.name) + '</button>';
    }).join('') + '</div>';
    var sections = A.state.categories.map(function (cat) {
      var items = list.filter(function (a) { return A.cap(a.cap).cat === cat.id; });
      if (!items.length) return '';
      return '<section class="section"><div class="section-head"><h2>' + esc(cat.name) + '</h2><span class="ui-note">' + esc(cat.desc) + '</span></div><div class="grid">' + items.map(card).join('') + '</div></section>';
    }).join('');
    return '<header class="page-heading"><div><h1>项目知识</h1><p class="ui-note">团队已发布的知识。应用后，本机的 iCode 就能用上。</p></div>' +
      '<div class="actions">' + (updates ? '<button data-action="dev-update-all">全部更新（' + updates + '）</button>' : '') +
      (pending ? '<button class="primary" data-action="dev-apply-all">全部应用（' + pending + '）</button>' : '') + '</div></header>' +
      tabs + '<div style="height:16px"></div>' + (sections || '<div class="empty">这个项目还没有发布的知识</div>');
  }

  function apply(a) {
    A.state.dev.applied[a.id] = { version: a.published.version, scope: K.defaultScope(a), at: A.now() };
  }
  A.actions['dev-project'] = function (el) { A.go('#/knowledge?project=' + encodeURIComponent(el.dataset.id)); };
  A.actions['dev-apply'] = function (el) {
    var a = A.artifact(el.dataset.id);
    el.classList.add('busy'); el.disabled = true;
    setTimeout(function () { apply(a); A.save(); A.refresh(); A.toast('已应用，范围：' + K.scopeText(A.state.dev.applied[a.id].scope)); }, 600);
  };
  A.actions['dev-update'] = function (el) {
    var a = A.artifact(el.dataset.id);
    el.classList.add('busy'); el.disabled = true;
    setTimeout(function () { A.state.dev.applied[a.id].version = a.published.version; A.save(); A.refresh(); A.toast('已更新到最新版本'); }, 600);
  };
  A.actions['dev-apply-all'] = function (el) {
    el.classList.add('busy'); el.disabled = true;
    setTimeout(function () {
      var n = 0;
      visible(view.project).forEach(function (a) { if (state(a) === 'none') { apply(a); n++; } });
      A.save(); A.refresh(); A.toast('已应用 ' + n + ' 项知识');
    }, 800);
  };
  A.actions['dev-update-all'] = function (el) {
    el.classList.add('busy'); el.disabled = true;
    setTimeout(function () {
      var n = 0;
      visible(view.project).forEach(function (a) { if (state(a) === 'update') { A.state.dev.applied[a.id].version = a.published.version; n++; } });
      A.save(); A.refresh(); A.toast('已更新 ' + n + ' 项知识');
    }, 800);
  };
  A.actions['dev-preview'] = function (el) { K.preview(A.artifact(el.dataset.id), { which: 'published' }); };
  A.actions['dev-changes'] = function (el) {
    var a = A.artifact(el.dataset.id), ap = A.state.dev.applied[a.id];
    A.dialog({ eyebrow: esc(a.name), title: '应用到本机 iCode 的改动',
      body: '<div class="form-body"><div class="apply-summary">' + esc(K.sentence(a, ap.scope)) + '</div><div class="change-list">' + K.changes(a, ap.scope) + '</div></div>' });
  };
  A.actions['dev-menu'] = function (el) {
    var a = A.artifact(el.dataset.id);
    A.popMenu(el, [
      ['修改范围', function () { scopeDialog(a); }],
      ['撤销应用', function () {
        A.confirm('撤销应用？', '撤销后，本机 iCode 不再使用「' + esc(a.name) + '」。', '撤销', true).then(function (ok) {
          if (!ok) return; delete A.state.dev.applied[a.id]; A.save(); A.refresh(); A.toast('已撤销');
        });
      }]
    ]);
  };

  function scopeDialog(a) {
    var ap = A.state.dev.applied[a.id];
    var sc = JSON.parse(JSON.stringify(ap.scope));
    if (!sc.repos) sc.repos = K.localRepos(a).map(function (r) { return r.repo; });
    if (!sc.agents) sc.agents = ['Code'];
    if (!sc.dir) sc.dir = 'chrys';
    var reasons = K.scopeOptions(a);
    var d = A.dialog({ eyebrow: esc(a.name), title: '修改范围', body: '<div class="form-body" data-form></div>', foot: '<button data-cancel>取消</button><button class="primary" data-ok>保存</button>' });
    function opt(id, title, desc, extra) {
      var dis = reasons[id];
      return '<label class="option"><input type="radio" name="scope" value="' + id + '"' + (sc.kind === id ? ' checked' : '') + (dis ? ' disabled' : '') + '><span><b>' + title + '</b><span class="caption">' + esc(dis || desc) + '</span>' +
        (sc.kind === id && extra ? '<span class="sub-options">' + extra + '</span>' : '') + '</span></label>';
    }
    function draw() {
      var repos = K.localRepos(a).map(function (l) { return '<label><input type="checkbox" name="repo" value="' + l.repo + '"' + (sc.repos.indexOf(l.repo) >= 0 ? ' checked' : '') + '>' + esc(l.name) + ' <span class="caption">' + esc(l.path) + '</span></label>'; }).join('');
      var dirs = '<label><input type="radio" name="dir" value="chrys"' + (sc.dir === 'chrys' ? ' checked' : '') + '>iCode 用户目录</label><label><input type="radio" name="dir" value="agents"' + (sc.dir === 'agents' ? ' checked' : '') + '>与其他工具共享的目录</label>';
      var agents = A.state.agents.map(function (g) { return '<label><input type="checkbox" name="agent" value="' + g.id + '"' + (sc.agents.indexOf(g.id) >= 0 ? ' checked' : '') + '>' + esc(g.name) + '</label>'; }).join('');
      var valid = sc.kind === 'repo' ? sc.repos.length > 0 : sc.kind === 'agent' ? sc.agents.length > 0 : true;
      var scope = { kind: sc.kind, repos: sc.repos, agents: sc.agents, dir: sc.dir };
      d.body.querySelector('[data-form]').innerHTML = '<div class="option-list">' +
        opt('repo', '本项目代码仓', '在本机的这些代码仓中工作时生效', repos) +
        opt('global', '所有智能体', '在任何目录中工作时都生效', dirs) +
        opt('agent', '指定智能体', '只对所选智能体生效', agents) + '</div>' +
        (valid ? '<div class="apply-summary">' + esc(K.sentence(a, scope)) + '</div>' +
          (sc.kind === 'repo' && K.kind(a) !== 'mcp' ? '<p class="caption">需在 iCode 设置中开启“加载项目 Skills”。</p>' : '') +
          '<details class="more"><summary>查看具体改动</summary><div class="change-list">' + K.changes(a, scope) + '</div></details>' : '<p class="hint">请至少选择一项。</p>');
      d.el.querySelector('[data-ok]').disabled = !valid;
    }
    d.body.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'scope') sc.kind = t.value;
      if (t.name === 'dir') sc.dir = t.value;
      if (t.name === 'repo') sc.repos = Array.prototype.map.call(d.body.querySelectorAll('input[name=repo]:checked'), function (x) { return x.value; });
      if (t.name === 'agent') sc.agents = Array.prototype.map.call(d.body.querySelectorAll('input[name=agent]:checked'), function (x) { return x.value; });
      draw();
    });
    d.el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    d.el.querySelector('[data-ok]').onclick = function () {
      ap.scope = sc.kind === 'repo' ? { kind: 'repo', repos: sc.repos } : sc.kind === 'global' ? { kind: 'global', dir: sc.dir } : { kind: 'agent', agents: sc.agents };
      A.save(); d.close(); A.refresh(); A.toast('范围：' + K.scopeText(ap.scope));
    };
    draw();
  }

  A.pages.knowledge = { title: '项目知识', role: 'dev', render: render };
})();
