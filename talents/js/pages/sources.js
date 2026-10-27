// 来源管理：项目、代码仓和文档集。团队会话由 iCode Teams 管理，只在新建任务选择会话时出现。
(function () {
  var A = App, esc = A.esc;
  function unassigned() {
    return A.state.sources.filter(function (s) { return s.type !== 'sessions' && !A.projectsOf(s.id).length; });
  }
  function names(list) { return list.length ? list.map(function (s) { return esc(s.name); }).join('、') : '<span class="ui-note">无</span>'; }

  function card(s, showType) {
    var fields = s.type === 'repo'
      ? '<dt>分支</dt><dd>' + esc(s.branch) + '</dd>'
      : '<dt>文件</dt><dd>' + s.files + ' 个' + (s.from ? (s.from.kind === 'git' ? '，来自 Git 仓库' : '，来自共享目录') : '') + '</dd>' +
        (A.latestVersion(s) ? '<dt>最近变化</dt><dd>' + esc(A.when(A.latestVersion(s))) + '</dd>' : '');
    return '<article class="card clickable" data-action="open-source" data-id="' + s.id + '">' +
      '<div class="card-head"><span class="icon">' + A.sourceIcon(s.type) + '</span>' +
      '<div class="grow"><h3>' + esc(s.name) + '</h3><div class="path">' + esc(s.path) + '</div></div></div>' +
      (s.desc ? '<p>' + esc(s.desc) + '</p>' : '') + '<dl class="fields">' + fields + '</dl>' +
      '<div class="card-foot"><div class="tags">' + (showType ? '<span class="tag">' + (s.type === 'repo' ? '代码仓' : '文档集') + '</span>' : '') + '</div>' +
      '<button class="link">详情</button></div></article>';
  }
  function projectCard(p) {
    var list = p.sourceIds.map(A.source).filter(Boolean);
    return '<article class="card clickable" data-action="open-project" data-id="' + p.id + '">' +
      '<div class="card-head"><span class="icon">◆</span><div class="grow"><h3>' + esc(p.name) + '</h3>' +
      (p.description ? '<p class="ui-note">' + esc(p.description) + '</p>' : '') + '</div></div>' +
      '<dl class="fields"><dt>代码仓</dt><dd>' + names(list.filter(function (s) { return s.type === 'repo'; })) + '</dd>' +
      '<dt>文档集</dt><dd>' + names(list.filter(function (s) { return s.type === 'docs'; })) + '</dd></dl>' +
      '<div class="card-foot"><span></span><button class="link">查看</button></div></article>';
  }

  function renderHome() {
    var st = A.state, loose = unassigned();
    return '<header class="page-heading"><div><h1>来源管理</h1><p class="ui-note">按项目登记和组织知识的来源：代码仓和文档集。</p></div>' +
      '<div class="actions"><button data-action="new-project">新建项目</button><button class="primary" data-action="new-source">＋ 登记来源</button></div></header>' +
      '<section class="section"><div class="section-head"><h2>项目</h2><span class="ui-note">' + st.projects.length + ' 个</span></div>' +
      (st.projects.length ? '<div class="grid">' + st.projects.map(projectCard).join('') + '</div>' : '<div class="empty"><b>还没有项目</b><span>新建项目，把相关的代码仓和文档集放在一起。</span></div>') + '</section>' +
      (loose.length ? '<section class="section"><div class="section-head"><h2>未归属的来源</h2><span class="ui-note">还没有加入任何项目</span></div>' +
        '<div class="grid">' + loose.map(function (s) { return card(s, true); }).join('') + '</div></section>' : '');
  }
  function renderProject(p) {
    var list = p.sourceIds.map(A.source).filter(Boolean);
    function section(type, title, empty) {
      var items = list.filter(function (s) { return s.type === type; });
      return '<section class="section"><div class="section-head"><h2>' + title + '</h2><span class="ui-note">' + items.length + ' 个</span></div>' +
        (items.length ? '<div class="grid">' + items.map(function (s) { return card(s, false); }).join('') + '</div>' : '<div class="empty"><span>' + empty + '</span></div>') + '</section>';
    }
    return '<a class="page-back" href="#/sources">← 来源管理</a>' +
      '<header class="page-heading"><div><h1>' + esc(p.name) + '</h1>' + (p.description ? '<p class="ui-note">' + esc(p.description) + '</p>' : '') + '</div>' +
      '<div class="actions"><button data-action="edit-project" data-id="' + p.id + '">编辑项目</button><button class="primary" data-action="new-source">＋ 登记来源</button></div></header>' +
      section('repo', '代码仓', '还没有代码仓，点“登记来源”添加。') +
      section('docs', '文档集', '还没有文档集，点“登记来源”添加。');
  }
  function current() { return A.route && A.route.page === 'sources' && A.project(A.route.params.project); }
  function render(params) {
    var p = params.project && A.project(params.project);
    return p ? renderProject(p) : renderHome();
  }
  A.actions['open-project'] = function (el) { A.go('#/sources?project=' + el.dataset.id); };

  // ---------- Details ----------
  function projectFields(s) {
    return '<dt>所属项目</dt><dd>' + (A.projectsOf(s.id).map(function (p) { return esc(p.name); }).join('、') || '<span class="ui-note">未归属</span>') + '</dd>';
  }
  function repoDetail(s) {
    return '<div class="form-body">' + (s.desc ? '<p>' + esc(s.desc) + '</p>' : '') + '<dl class="fields">' +
      '<dt>路径</dt><dd class="path">' + esc(s.path) + '</dd><dt>远端</dt><dd class="path">' + esc(s.origin) + '</dd>' +
      '<dt>当前分支</dt><dd>' + esc(s.branch) + '</dd>' +
      '<dt>最近提交</dt><dd><code>' + esc(s.commit.sha) + '</code> ' + esc(s.commit.message) + '<div class="caption">' + esc(s.commit.time) + '</div></dd>' +
      projectFields(s) + '</dl></div>';
  }
  // When each file last changed: the newest version that added or modified it, otherwise the first version.
  function fileTimes(s) {
    var at = {}, versions = s.versions || [], first = versions.length ? versions[versions.length - 1].at : '';
    versions.forEach(function (v) { (v.added || []).concat(v.modified || []).forEach(function (f) { if (!at[f]) at[f] = v.at; }); });
    return { of: function (f) { return at[f] || first; } };
  }
  function versionItem(v) {
    if (v.initial) return '<li><details><summary><b>' + esc(A.when(v.at)) + '</b><span class="ui-note">首次检查，' + v.initial + ' 个文件</span></summary></details></li>';
    var c = { added: v.added || [], modified: v.modified || [], removed: v.removed || [] };
    var list = c.added.map(function (f) { return '<li><span class="mark new">新</span> ' + esc(f) + '</li>'; })
      .concat(c.modified.map(function (f) { return '<li><span class="mark">改</span> ' + esc(f) + '</li>'; }))
      .concat(c.removed.map(function (f) { return '<li><span class="mark del">删</span> ' + esc(f) + '</li>'; }));
    return '<li><details><summary><b>' + esc(A.when(v.at)) + '</b><span>' + esc(A.changeCounts(c)) + '</span></summary><ul class="file-table">' + list.join('') + '</ul></details></li>';
  }
  var FILE_ROWS = 10;
  function docsDetail(s) {
    var files = [], times = fileTimes(s), latest = (s.versions || [])[0] || {};
    s.tree.forEach(function (g) { g.files.forEach(function (f) { files.push({ name: f, dir: g.dir || '根目录', key: (g.dir ? g.dir + '/' : '') + f }); }); });
    var rows = files.map(function (f, i) {
      var mark = (latest.added || []).indexOf(f.key) >= 0 ? ' <span class="mark new">新</span>' : (latest.modified || []).indexOf(f.key) >= 0 ? ' <span class="mark">改</span>' : '';
      return '<tr' + (i >= FILE_ROWS ? ' data-more hidden' : '') + '><td>' + esc(f.name) + mark + '</td><td class="ui-note nowrap">' + esc(f.dir) + '</td><td class="ui-note nowrap">' + esc(A.when(times.of(f.key))) + '</td></tr>';
    }).join('');
    var from = s.from && s.from.kind === 'git' ? 'Git 仓库 <span class="path">' + esc(s.from.origin) + '</span>，分支 ' + esc(s.from.branch) : '共享目录';
    return '<div class="form-body">' + (s.desc ? '<p>' + esc(s.desc) + '</p>' : '') + '<dl class="fields">' +
      '<dt>路径</dt><dd class="path">' + esc(s.path) + '</dd>' +
      (s.from ? '<dt>来自</dt><dd>' + from + '</dd>' : '') +
      '<dt>文件</dt><dd>' + s.files + ' 个</dd>' +
      '<dt>最近检查</dt><dd><span data-last-check>' + esc(A.when(s.lastCheck || '')) + '，没有变化</span> <button class="link" data-check>检查更新</button></dd>' +
      (s.versions && s.versions.length ? '<dt>版本记录</dt><dd><ul class="version-list">' + s.versions.map(versionItem).join('') + '</ul>' +
        '<span class="caption">检查发现文件有变化时记录一个版本。</span></dd>' : '') +
      projectFields(s) + '</dl>' +
      '<div class="field"><span class="label">文件</span><div class="table-wrap"><table class="data file-table"><thead><tr><th>文件名</th><th>所在目录</th><th>更新时间</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (files.length > FILE_ROWS ? '<div><button class="link" data-show-all>显示其余 ' + (files.length - FILE_ROWS) + ' 个文件</button></div>' : '') + '</div></div>';
  }
  function editSource(s, done) {
    var d = A.dialog({
      title: '编辑来源', eyebrow: s.type === 'repo' ? '代码仓' : '文档集',
      body: '<div class="form-body"><label class="field"><span class="label">名称</span><input data-name value="' + esc(s.name) + '"></label>' +
        '<label class="field"><span class="label">说明 <span class="caption">可选</span></span><textarea rows="2" data-desc placeholder="一句话说明这个来源的内容">' + esc(s.desc || '') + '</textarea></label>' +
        '<div class="field"><span class="label">所属项目</span><div class="option-list">' + A.state.projects.map(function (p) {
          return '<label class="option"><input type="checkbox" value="' + p.id + '"' + (p.sourceIds.indexOf(s.id) >= 0 ? ' checked' : '') + '><span>' + esc(p.name) + '</span></label>';
        }).join('') + '</div></div></div>',
      foot: '<button data-cancel>取消</button><button class="primary" data-ok>保存</button>'
    });
    d.el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    d.el.querySelector('[data-ok]').onclick = function () {
      var name = d.el.querySelector('[data-name]').value.trim();
      if (!name) { d.el.querySelector('[data-name]').focus(); return; }
      s.name = name; s.desc = d.el.querySelector('[data-desc]').value.trim();
      var on = Array.prototype.map.call(d.el.querySelectorAll('.option input:checked'), function (c) { return c.value; });
      A.state.projects.forEach(function (p) {
        var has = p.sourceIds.indexOf(s.id) >= 0, want = on.indexOf(p.id) >= 0;
        if (want && !has) p.sourceIds.push(s.id);
        if (!want && has) p.sourceIds = p.sourceIds.filter(function (id) { return id !== s.id; });
      });
      A.save(); d.close(); A.refresh(); done(); A.toast('已保存');
    };
  }
  A.actions['open-source'] = function (el) {
    var s = A.source(el.dataset.id);
    var d = A.drawer({
      eyebrow: s.type === 'repo' ? '代码仓' : '文档集', title: esc(s.name),
      headActions: '<button data-edit>编辑</button>',
      body: '<div data-detail></div>',
      foot: '<button class="danger" data-remove>移除来源</button><span style="flex:1"></span><button data-new-task>新建知识任务</button>'
    });
    function draw() {
      d.setTitle(esc(s.name));
      d.body.querySelector('[data-detail]').innerHTML = s.type === 'repo' ? repoDetail(s) : docsDetail(s);
      var more = d.el.querySelector('[data-show-all]');
      if (more) more.onclick = function () {
        d.el.querySelectorAll('tr[data-more]').forEach(function (tr) { tr.hidden = false; });
        more.parentNode.remove();
      };
      var check = d.el.querySelector('[data-check]');
      if (check) check.onclick = function () {
        check.classList.add('busy'); check.disabled = true;
        setTimeout(function () {
          s.lastCheck = A.now(); A.save(); draw();
          A.toast('检查完成：文件没有变化');
        }, 900);
      };
    }
    draw();
    d.el.querySelector('[data-edit]').onclick = function () { editSource(s, draw); };
    d.el.querySelector('[data-remove]').onclick = function () {
      A.confirm('移除来源“' + esc(s.name) + '”？', '移除后不再出现在来源列表中，已生成的产物仍然保留。', '移除', true).then(function (ok) {
        if (!ok) return;
        A.state.sources = A.state.sources.filter(function (x) { return x !== s; });
        A.state.projects.forEach(function (p) { p.sourceIds = p.sourceIds.filter(function (id) { return id !== s.id; }); });
        A.save(); d.close(); A.refresh(); A.toast('已移除');
      });
    };
    d.el.querySelector('[data-new-task]').onclick = function () { d.close(); A.go('#/tasks?new=1&source=' + s.id); };
  };

  // ---------- Register a source ----------
  var samples = {
    repo: [
      { path: '~/work/card-core/card-core-batch', origin: 'git@code.bank.local:card-core/card-core-batch.git', branch: 'main', sha: '9e1c4b0', message: '对账作业改为按日期分区执行', time: '2026-10-24 22:05', desc: 'Spring Batch 批处理作业，共 18 个作业' },
      { path: '~/work/card-core/card-core-gateway', origin: 'git@code.bank.local:card-core/card-core-gateway.git', branch: 'main', sha: '31d7aa2', message: '限流规则改为按渠道配置', time: '2026-10-23 17:48', desc: '基于 Spring Cloud Gateway 的 API 网关' }
    ],
    docs: [
      { path: '~/work/card-core/requirements', files: 31, ext: 'md 18、docx 9、pdf 4', from: { kind: 'git', origin: 'git@code.bank.local:card-core/card-core-requirements.git', branch: 'main' }, tree: [{ dir: '2026Q3', files: ['分期还款需求说明.docx', '额度调整需求说明.md'] }, { dir: '2026Q4', files: ['营销活动二期需求.md', '账单分期改造.md'] }] },
      { path: '/Volumes/team-share/card-core/meeting-notes', files: 46, ext: 'md 46', from: { kind: 'shared' }, tree: [{ dir: '', files: ['2026-10-21 需求评审.md', '2026-10-14 架构评审.md', '2026-10-09 迁移周会.md'] }] }
    ]
  };
  A.actions['new-source'] = function () {
    var st = { type: 'repo', probe: null };
    var here = current(), defaultProject = here ? here.id : null;
    var d = A.drawer({
      title: '登记来源',
      body: '<div class="form-body">' +
        '<div class="field"><span class="label"><span class="step">1</span>类型</span><div class="option-list inline">' +
        '<label class="option"><input type="radio" name="type" value="repo" checked><span><b>代码仓</b><span class="caption">本地 Git 仓库</span></span></label>' +
        '<label class="option"><input type="radio" name="type" value="docs"><span><b>文档集</b><span class="caption">需求、设计、规范等文档目录</span></span></label></div></div>' +
        '<div class="field"><span class="label"><span class="step">2</span>目录</span><div class="actions" style="flex-wrap:nowrap"><input data-path list="path-suggest" placeholder="选择或输入本地目录" style="flex:1"><button data-probe>读取</button></div>' +
        '<datalist id="path-suggest"></datalist><div data-overview></div></div>' +
        '<div data-step3 hidden class="form-body" style="padding:0"><label class="field"><span class="label"><span class="step">3</span>名称</span><input data-name></label>' +
        '<label class="field"><span class="label">说明 <span class="caption">可选</span></span><input data-desc placeholder="一句话说明这个来源的内容"></label>' +
        '<div class="field"><span class="label"><span class="step">4</span>所属项目</span><div class="option-list">' + A.state.projects.map(function (p) {
          return '<label class="option"><input type="checkbox" name="proj" value="' + p.id + '"' + (p.id === defaultProject || A.state.projects.length === 1 ? ' checked' : '') + '><span>' + esc(p.name) + '</span></label>';
        }).join('') + '</div></div></div></div>',
      foot: '<button data-cancel>取消</button><button class="primary" data-ok disabled>登记</button>'
    });
    var el = d.el;
    function suggest() {
      el.querySelector('#path-suggest').innerHTML = samples[st.type].map(function (x) { return '<option value="' + x.path + '">'; }).join('');
      el.querySelector('[data-path]').value = samples[st.type][0].path;
      st.probe = null; el.querySelector('[data-overview]').innerHTML = ''; el.querySelector('[data-step3]').hidden = true; el.querySelector('[data-ok]').disabled = true;
    }
    el.querySelectorAll('input[name=type]').forEach(function (r) { r.onchange = function () { st.type = r.value; suggest(); }; });
    el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    el.querySelector('[data-probe]').onclick = function () {
      var btn = this, path = el.querySelector('[data-path]').value.trim();
      if (!path) return;
      btn.classList.add('busy'); btn.disabled = true;
      setTimeout(function () {
        btn.classList.remove('busy'); btn.disabled = false;
        var base = samples[st.type].filter(function (x) { return x.path === path; })[0] || JSON.parse(JSON.stringify(samples[st.type][0]));
        base.path = path;
        st.probe = base;
        el.querySelector('[data-overview]').innerHTML = '<div class="info"><dl class="fields">' + (st.type === 'repo'
          ? '<dt>远端</dt><dd class="path">' + esc(base.origin) + '</dd><dt>当前分支</dt><dd>' + esc(base.branch) + '</dd><dt>最近提交</dt><dd><code>' + base.sha + '</code> ' + esc(base.message) + '</dd>'
          : '<dt>来自</dt><dd>' + (base.from.kind === 'git' ? 'Git 仓库 <span class="path">' + esc(base.from.origin) + '</span>' : '共享目录') + '</dd>' +
            '<dt>文件</dt><dd>' + base.files + ' 个（' + base.ext + '）</dd><dt>示例</dt><dd>' + esc(base.tree[0].files.slice(0, 2).join('、')) + '</dd>') + '</dl></div>';
        el.querySelector('[data-name]').value = path.split('/').pop();
        el.querySelector('[data-desc]').value = base.desc || '';
        el.querySelector('[data-step3]').hidden = false;
        el.querySelector('[data-ok]').disabled = false;
      }, 700);
    };
    el.querySelector('[data-ok]').onclick = function () {
      var p = st.probe, id = A.uid('s');
      var src = st.type === 'repo'
        ? { id: id, type: 'repo', name: el.querySelector('[data-name]').value.trim() || p.path.split('/').pop(), path: p.path, origin: p.origin, branch: p.branch, commit: { sha: p.sha, message: p.message, time: p.time }, prs: 0 }
        : { id: id, type: 'docs', name: el.querySelector('[data-name]').value.trim() || p.path.split('/').pop(), path: p.path, files: p.files, tree: p.tree,
            from: p.from, lastCheck: A.now(), versions: [{ at: A.now(), initial: p.files }] };
      src.desc = el.querySelector('[data-desc]').value.trim();
      A.state.sources.push(src);
      el.querySelectorAll('input[name=proj]:checked').forEach(function (c) { A.project(c.value).sourceIds.push(id); });
      A.save(); d.close(); A.refresh(); A.toast('已登记“' + src.name + '”');
    };
    suggest();
  };

  // ---------- Projects ----------
  function projectEditor(project) {
    var candidates = A.state.sources.filter(function (s) { return s.type !== 'sessions'; });
    var d = A.drawer({
      title: project ? '编辑项目' : '新建项目',
      body: '<div class="form-body">' +
        '<label class="field"><span class="label">名称</span><input data-name value="' + esc(project ? project.name : '') + '" placeholder="例如：信用卡核心系统" autofocus></label>' +
        '<label class="field"><span class="label">说明</span><textarea data-desc rows="2" placeholder="可选">' + esc(project ? project.description : '') + '</textarea></label>' +
        '<div class="field"><span class="label">包含的来源</span><div class="option-list">' + candidates.map(function (s) {
          var on = project && project.sourceIds.indexOf(s.id) >= 0;
          return '<label class="option"><input type="checkbox" value="' + s.id + '"' + (on ? ' checked' : '') + '><span><b>' + esc(s.name) + ' <span class="tag">' + (s.type === 'repo' ? '代码仓' : '文档集') + '</span></b><span class="caption path">' + esc(s.path) + '</span></span></label>';
        }).join('') + '</div></div></div>',
      foot: '<button data-cancel>取消</button><button class="primary" data-ok>保存</button>'
    });
    d.el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    d.el.querySelector('[data-ok]').onclick = function () {
      var name = d.el.querySelector('[data-name]').value.trim();
      if (!name) { d.el.querySelector('[data-name]').focus(); return; }
      var ids = Array.prototype.map.call(d.el.querySelectorAll('.option input:checked'), function (c) { return c.value; });
      if (project) { project.name = name; project.description = d.el.querySelector('[data-desc]').value.trim(); project.sourceIds = ids; }
      else { project = { id: A.uid('p'), name: name, description: d.el.querySelector('[data-desc]').value.trim(), sourceIds: ids }; A.state.projects.push(project); A.save(); d.close(); A.toast('已新建项目'); A.go('#/sources?project=' + project.id); return; }
      A.save(); d.close(); A.refresh(); A.toast('已保存项目');
    };
  }
  A.actions['new-project'] = function () { projectEditor(null); };
  A.actions['edit-project'] = function (el) { projectEditor(A.project(el.dataset.id)); };

  A.pages.sources = {
    title: '来源管理', role: 'admin', render: render,
    crumb: function (p) { var x = p.project && A.project(p.project); return x ? '来源管理 / ' + x.name : '来源管理'; }
  };
})();
