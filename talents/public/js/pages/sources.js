// 来源管理：项目、代码仓和设计文档来自 iCode Teams，在这里只读；Talents 只登记本地文档目录。
// 团队会话也由 iCode Teams 管理，只在新建任务选择会话时出现。
(function () {
  var A = App, esc = A.esc;
  function unassigned() {
    return A.state.sources.filter(function (s) { return s.type !== 'sessions' && !A.projectsOf(s.id).length; });
  }
  function names(list) { return list.length ? list.map(function (s) { return esc(s.name); }).join('、') : '<span class="ui-note">无</span>'; }
  function fromText(s) {
    if (!s.from) return '';
    return { teams: '来自 iCode Teams', git: '来自 Git 仓库', shared: '来自共享目录' }[s.from.kind] || '';
  }
  function teamsButton(projectId, label) {
    return '<a class="button" href="' + esc(A.teamsLink(projectId)) + '">' + (label || '在 iCode Teams 中管理') + '</a>';
  }

  function card(s, showType) {
    var fields = s.type === 'repo'
      ? '<dt>分支</dt><dd>' + esc(s.branch) + '</dd>'
      : '<dt>文件</dt><dd>' + s.files + ' 个' + (fromText(s) ? '，' + fromText(s) : '') + '</dd>' +
        (A.latestVersion(s) ? '<dt>最近变化</dt><dd>' + esc(A.when(A.latestVersion(s))) + '</dd>' : '');
    var tags = (s.fromTeams ? '<span class="tag">iCode Teams</span>' : '<span class="tag">本地登记</span>') +
      (showType ? '<span class="tag">' + (s.type === 'repo' ? '代码仓' : '文档集') + '</span>' : '');
    return '<article class="card clickable" data-action="open-source" data-id="' + esc(s.id) + '">' +
      '<div class="card-head"><span class="icon">' + A.sourceIcon(s.type) + '</span>' +
      '<div class="grow"><h3>' + esc(s.name) + '</h3><div class="path">' + esc(s.path) + '</div></div></div>' +
      (s.desc ? '<p>' + esc(s.desc) + '</p>' : '') + '<dl class="fields">' + fields + '</dl>' +
      '<div class="card-foot"><div class="tags">' + tags + '</div>' +
      '<button class="link">详情</button></div></article>';
  }
  function projectCard(p) {
    var list = p.sourceIds.map(A.source).filter(Boolean);
    return '<article class="card clickable" data-action="open-project" data-id="' + esc(p.id) + '">' +
      '<div class="card-head"><span class="icon">◆</span><div class="grow"><h3>' + esc(p.name) + '</h3>' +
      (p.description ? '<p class="ui-note">' + esc(p.description) + '</p>' : '') + '</div></div>' +
      '<dl class="fields"><dt>代码仓</dt><dd>' + names(list.filter(function (s) { return s.type === 'repo'; })) + '</dd>' +
      '<dt>文档集</dt><dd>' + names(list.filter(function (s) { return s.type === 'docs'; })) + '</dd></dl>' +
      '<div class="card-foot"><span></span><button class="link">查看</button></div></article>';
  }

  function renderHome() {
    var st = A.state, loose = unassigned();
    return '<header class="page-heading"><div><h1>来源管理</h1><p class="ui-note">项目、代码仓和设计文档来自 iCode Teams；还可以登记本地文档目录作为知识来源。</p></div>' +
      '<div class="actions">' + teamsButton(null, '在 iCode Teams 中管理项目') + '<button class="primary" data-action="new-source">＋ 登记本地文档来源</button></div></header>' +
      '<section class="section"><div class="section-head"><h2>项目</h2><span class="ui-note">' + st.projects.length + ' 个，来自 iCode Teams</span></div>' +
      (st.projects.length ? '<div class="grid">' + st.projects.map(projectCard).join('') + '</div>' : '<div class="empty"><b>还没有项目</b><span>在 iCode Teams 中创建项目后，会出现在这里。</span></div>') + '</section>' +
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
      '<div class="actions">' + teamsButton(p.id) + '<button class="primary" data-action="new-source">＋ 登记本地文档来源</button></div></header>' +
      section('repo', '代码仓', '这个 iCode Teams 项目还没有本机代码仓。') +
      section('docs', '文档集', '还没有文档。设计文档在 iCode Teams 项目中添加，也可以登记本地文档目录。');
  }
  function current() { return A.route && A.route.page === 'sources' && A.project(A.route.params.project); }
  function render(params) {
    var p = params.project && A.project(params.project);
    return p ? renderProject(p) : renderHome();
  }
  A.actions['open-project'] = function (el) { A.go('#/sources?project=' + encodeURIComponent(el.dataset.id)); };

  // ---------- Details ----------
  function projectFields(s) {
    return '<dt>所属项目</dt><dd>' + (A.projectsOf(s.id).map(function (p) { return esc(p.name); }).join('、') || '<span class="ui-note">未归属</span>') + '</dd>';
  }
  function teamsNote(s) {
    return s.fromTeams ? '<p class="caption">来自 iCode Teams，在 Talents 中只读；增删或修改请在 iCode Teams 中进行。</p>' : '';
  }
  function repoDetail(s) {
    return '<div class="form-body">' + (s.desc ? '<p>' + esc(s.desc) + '</p>' : '') + '<dl class="fields">' +
      '<dt>路径</dt><dd class="path">' + esc(s.path) + '</dd>' + (s.origin ? '<dt>远端</dt><dd class="path">' + esc(s.origin) + '</dd>' : '') +
      '<dt>当前分支</dt><dd>' + esc(s.branch) + '</dd>' +
      (s.commit ? '<dt>最近提交</dt><dd><code>' + esc(s.commit.sha) + '</code> ' + esc(s.commit.message) + '<div class="caption">' + esc(s.commit.time) + '</div></dd>' : '') +
      projectFields(s) + '</dl>' + teamsNote(s) + '</div>';
  }
  // When each file last changed: the newest version that added or modified it, otherwise the first version.
  function fileTimes(s) {
    var at = {}, versions = s.versions || [], first = versions.length ? versions[versions.length - 1].at : '';
    versions.forEach(function (v) { (v.added || []).concat(v.modified || []).forEach(function (f) { if (!at[f]) at[f] = v.at; }); });
    return { of: function (f) { return at[f] || first; } };
  }
  function versionItem(v) {
    if (v.initial) return '<li><details><summary><b>' + esc(A.when(v.at)) + '</b><span class="ui-note">首次检查，' + v.initial + ' 个文件</span></summary>' +
      (v.files ? '<ul class="file-table">' + v.files.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') + '</details></li>';
    var c = { added: v.added || [], modified: v.modified || [], removed: v.removed || [] };
    var list = c.added.map(function (f) { return '<li><span class="mark new">新</span> ' + esc(f) + '</li>'; })
      .concat(c.modified.map(function (f) { return '<li><span class="mark">改</span> ' + esc(f) + '</li>'; }))
      .concat(c.removed.map(function (f) { return '<li><span class="mark del">删</span> ' + esc(f) + '</li>'; }));
    return '<li><details><summary><b>' + esc(A.when(v.at)) + '</b><span>' + esc(A.changeCounts(c)) + '</span></summary><ul class="file-table">' + list.join('') + '</ul></details></li>';
  }
  var FILE_ROWS = 10;
  function docsDetail(s) {
    var files = [], times = fileTimes(s), latest = (s.versions || [])[0] || {}, titles = s.titles || {};
    s.tree.forEach(function (g) { g.files.forEach(function (f) { files.push({ name: f, dir: g.dir || '根目录', key: (g.dir ? g.dir + '/' : '') + f }); }); });
    var rows = files.map(function (f, i) {
      var mark = (latest.added || []).indexOf(f.key) >= 0 ? ' <span class="mark new">新</span>' : (latest.modified || []).indexOf(f.key) >= 0 ? ' <span class="mark">改</span>' : '';
      return '<tr' + (i >= FILE_ROWS ? ' data-more hidden' : '') + '><td>' + esc(f.name) + mark + (titles[f.key] ? '<div class="caption">' + esc(titles[f.key]) + '</div>' : '') + '</td>' +
        '<td class="ui-note nowrap">' + esc(f.dir) + '</td><td class="ui-note nowrap">' + esc(A.when(times.of(f.key))) + '</td></tr>';
    }).join('');
    var from = !s.from ? '' : s.from.kind === 'git' ? 'Git 仓库 <span class="path">' + esc(s.from.origin) + '</span>，分支 ' + esc(s.from.branch)
      : s.from.kind === 'teams' ? 'iCode Teams 项目「' + esc(s.from.project) + '」的设计文档' : '共享目录';
    return '<div class="form-body">' + (s.desc ? '<p>' + esc(s.desc) + '</p>' : '') + '<dl class="fields">' +
      '<dt>路径</dt><dd class="path">' + esc(s.path) + '</dd>' +
      (from ? '<dt>来自</dt><dd>' + from + '</dd>' : '') +
      '<dt>文件</dt><dd>' + s.files + ' 个</dd>' +
      '<dt>最近检查</dt><dd><span data-last-check>' + esc(A.when(s.lastCheck || '')) + '</span> <button class="link" data-check>检查更新</button></dd>' +
      (s.versions && s.versions.length ? '<dt>版本记录</dt><dd><ul class="version-list">' + s.versions.map(versionItem).join('') + '</ul>' +
        '<span class="caption">检查发现文件有变化时记录一个版本。</span></dd>' : '') +
      projectFields(s) + '</dl>' + teamsNote(s) +
      '<div class="field"><span class="label">文件</span><div class="table-wrap"><table class="data file-table"><thead><tr><th>文件名</th><th>所在目录</th><th>更新时间</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (files.length > FILE_ROWS ? '<div><button class="link" data-show-all>显示其余 ' + (files.length - FILE_ROWS) + ' 个文件</button></div>' : '') + '</div></div>';
  }
  // Checking a Teams document set compares the documents Teams lists now with the latest recorded version;
  // a difference is recorded as a new version. Local directories are mock: their check finds no change.
  function check(s) {
    s.lastCheck = A.now();
    if (!s.fromTeams || s.type !== 'docs') return null;
    var now = A.sourceFiles(s), known = A.knownFiles(s);
    var added = now.filter(function (f) { return known.indexOf(f) < 0; });
    var removed = known.filter(function (f) { return now.indexOf(f) < 0; });
    if (!added.length && !removed.length) return null;
    var v = { at: s.lastCheck };
    if (added.length) v.added = added;
    if (removed.length) v.removed = removed;
    s.versions.unshift(v);
    return v;
  }
  function editSource(s, done) {
    var d = A.dialog({
      title: '编辑来源', eyebrow: '本地文档目录',
      body: '<div class="form-body"><label class="field"><span class="label">名称</span><input data-name value="' + esc(s.name) + '"></label>' +
        '<label class="field"><span class="label">说明 <span class="caption">可选</span></span><textarea rows="2" data-desc placeholder="一句话说明这个来源的内容">' + esc(s.desc || '') + '</textarea></label>' +
        '<div class="field"><span class="label">所属项目</span><div class="option-list">' + A.state.projects.map(function (p) {
          return '<label class="option"><input type="checkbox" value="' + esc(p.id) + '"' + (p.sourceIds.indexOf(s.id) >= 0 ? ' checked' : '') + '><span>' + esc(p.name) + '</span></label>';
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
    var local = !s.fromTeams;
    var d = A.drawer({
      eyebrow: (s.type === 'repo' ? '代码仓' : '文档集') + (local ? '，本地登记' : '，来自 iCode Teams'), title: esc(s.name),
      headActions: local ? '<button data-edit>编辑</button>' : '',
      body: '<div data-detail></div>',
      foot: (local ? '<button class="danger" data-remove>移除来源</button>' : teamsButton(s.projectId)) + '<span style="flex:1"></span><button data-new-task>新建知识任务</button>'
    });
    function draw() {
      d.setTitle(esc(s.name));
      d.body.querySelector('[data-detail]').innerHTML = s.type === 'repo' ? repoDetail(s) : docsDetail(s);
      var more = d.el.querySelector('[data-show-all]');
      if (more) more.onclick = function () {
        d.el.querySelectorAll('tr[data-more]').forEach(function (tr) { tr.hidden = false; });
        more.parentNode.remove();
      };
      var btn = d.el.querySelector('[data-check]');
      if (btn) btn.onclick = function () {
        btn.classList.add('busy'); btn.disabled = true;
        setTimeout(function () {
          var v = check(s);
          A.save(); draw(); A.refresh();
          A.toast(v ? '检查完成：发现变化（' + A.changeCounts({ added: v.added || [], modified: [], removed: v.removed || [] }) + '），已记录新版本' : '检查完成：文件没有变化');
        }, 900);
      };
    }
    draw();
    if (local) {
      d.el.querySelector('[data-edit]').onclick = function () { editSource(s, draw); };
      d.el.querySelector('[data-remove]').onclick = function () {
        A.confirm('移除来源“' + esc(s.name) + '”？', '移除后不再出现在来源列表中，已生成的产物仍然保留。', '移除', true).then(function (ok) {
          if (!ok) return;
          A.state.sources = A.state.sources.filter(function (x) { return x !== s; });
          A.state.projects.forEach(function (p) { p.sourceIds = p.sourceIds.filter(function (id) { return id !== s.id; }); });
          A.save(); d.close(); A.refresh(); A.toast('已移除');
        });
      };
    }
    d.el.querySelector('[data-new-task]').onclick = function () { d.close(); A.go('#/tasks?new=1&source=' + encodeURIComponent(s.id)); };
  };

  // ---------- Register a local document directory ----------
  var samples = [
    { path: '/Volumes/team-share/carddemo/meeting-notes', files: 46, ext: 'md 46', from: { kind: 'shared' }, tree: [{ dir: '', files: ['2026-10-21 需求评审.md', '2026-10-14 架构评审.md', '2026-10-09 返现方案周会.md'] }] },
    { path: '~/work/carddemo/requirements', files: 31, ext: 'md 18、docx 9、pdf 4', from: { kind: 'git', origin: 'git@code.bank.local:carddemo/carddemo-requirements.git', branch: 'main' }, tree: [{ dir: '2026Q3', files: ['分期还款需求说明.docx', '额度调整需求说明.md'] }, { dir: '2026Q4', files: ['营销活动二期需求.md', '账单分期改造.md'] }] }
  ];
  A.actions['new-source'] = function () {
    var st = { probe: null };
    var here = current(), defaultProject = here ? here.id : A.focusProject;
    var d = A.drawer({
      title: '登记本地文档来源',
      body: '<div class="form-body">' +
        '<p class="caption">代码仓和设计文档来自 iCode Teams 项目。这里登记 Talents 自己读取的本地或共享文档目录，例如行内规范、会议纪要。</p>' +
        '<div class="field"><span class="label"><span class="step">1</span>目录</span><div class="actions" style="flex-wrap:nowrap"><input data-path list="path-suggest" placeholder="选择或输入本地文档目录" style="flex:1"><button data-probe>读取</button></div>' +
        '<datalist id="path-suggest">' + samples.map(function (x) { return '<option value="' + esc(x.path) + '">'; }).join('') + '</datalist><div data-overview></div></div>' +
        '<div data-step3 hidden class="form-body" style="padding:0"><label class="field"><span class="label"><span class="step">2</span>名称</span><input data-name></label>' +
        '<label class="field"><span class="label">说明 <span class="caption">可选</span></span><input data-desc placeholder="一句话说明这个来源的内容"></label>' +
        '<div class="field"><span class="label"><span class="step">3</span>所属项目</span><div class="option-list">' + A.state.projects.map(function (p) {
          return '<label class="option"><input type="checkbox" name="proj" value="' + esc(p.id) + '"' + (p.id === defaultProject || A.state.projects.length === 1 ? ' checked' : '') + '><span>' + esc(p.name) + '</span></label>';
        }).join('') + '</div></div></div></div>',
      foot: '<button data-cancel>取消</button><button class="primary" data-ok disabled>登记</button>'
    });
    var el = d.el;
    el.querySelector('[data-path]').value = samples[0].path;
    el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    el.querySelector('[data-probe]').onclick = function () {
      var btn = this, path = el.querySelector('[data-path]').value.trim();
      if (!path) return;
      btn.classList.add('busy'); btn.disabled = true;
      setTimeout(function () {
        btn.classList.remove('busy'); btn.disabled = false;
        var base = JSON.parse(JSON.stringify(samples.filter(function (x) { return x.path === path; })[0] || samples[0]));
        base.path = path;
        st.probe = base;
        el.querySelector('[data-overview]').innerHTML = '<div class="info"><dl class="fields">' +
          '<dt>来自</dt><dd>' + (base.from.kind === 'git' ? 'Git 仓库 <span class="path">' + esc(base.from.origin) + '</span>' : '共享目录') + '</dd>' +
          '<dt>文件</dt><dd>' + base.files + ' 个（' + base.ext + '）</dd><dt>示例</dt><dd>' + esc(base.tree[0].files.slice(0, 2).join('、')) + '</dd></dl></div>';
        el.querySelector('[data-name]').value = path.split('/').pop();
        el.querySelector('[data-step3]').hidden = false;
        el.querySelector('[data-ok]').disabled = false;
      }, 700);
    };
    el.querySelector('[data-ok]').onclick = function () {
      var p = st.probe, id = A.uid('s');
      var src = { id: id, type: 'docs', name: el.querySelector('[data-name]').value.trim() || p.path.split('/').pop(), path: p.path, files: p.files, tree: p.tree,
        from: p.from, lastCheck: A.now(), versions: [{ at: A.now(), initial: p.files }], desc: el.querySelector('[data-desc]').value.trim() };
      A.state.sources.push(src);
      el.querySelectorAll('input[name=proj]:checked').forEach(function (c) { A.project(c.value).sourceIds.push(id); });
      A.save(); d.close(); A.refresh(); A.toast('已登记“' + src.name + '”');
    };
  };

  A.pages.sources = {
    title: '来源管理', role: 'admin', render: render,
    crumb: function (p) { var x = p.project && A.project(p.project); return x ? '来源管理 / ' + x.name : '来源管理'; }
  };
})();
