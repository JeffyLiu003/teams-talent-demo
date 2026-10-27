// 开发者端 · 本地索引：为本机的代码仓和文档建立索引，供本机 iCode 查询。
(function () {
  var A = App, esc = A.esc;
  var building = {};

  function card(l) {
    var b = building[l.id];
    var status = b ? '<div data-build="' + l.id + '"><div class="progress"><i style="width:' + b.pct + '%"></i></div><p class="caption" style="margin-top:6px">正在建立索引…</p></div>'
      : l.index ? '<dl class="fields"><dt>索引</dt><dd>已建立，更新于 ' + esc(A.when(l.index.at)) + '</dd>' + (l.applied ? '<dt>使用</dt><dd>Code Agent 可以查询</dd>' : '') + '</dl>'
      : '<dl class="fields"><dt>索引</dt><dd>尚未建立</dd></dl>';
    var actions = b ? '' : (l.index ? '<button data-action="local-build" data-id="' + l.id + '">更新索引</button>' + (l.applied ? '' : '<button class="primary" data-action="local-apply" data-id="' + l.id + '">应用到 iCode</button>')
      : '<button class="primary" data-action="local-build" data-id="' + l.id + '">建立索引</button>');
    return '<article class="card"><div class="card-head"><span class="icon">' + A.sourceIcon(l.type) + '</span><div class="grow"><h3>' + esc(l.name) + '</h3><div class="path">' + esc(l.path) + '</div></div>' +
      '<span class="tag">' + (l.type === 'repo' ? '代码仓' : '文档目录') + '</span></div>' + status +
      '<div class="card-foot"><span class="caption">' + (l.type === 'repo' ? 'CodeGraph' : '文档 RAG 检索') + '</span><div class="actions">' + actions + '</div></div></article>';
  }
  function render() {
    return '<header class="page-heading"><div><h1>本地索引</h1><p class="ui-note">为本机的代码仓和文档建立索引，iCode 可以查询到还没提交的最新代码。</p></div>' +
      '<div class="actions"><button class="primary" data-action="local-add">＋ 添加目录</button></div></header>' +
      '<div class="grid">' + A.state.dev.local.map(card).join('') + '</div>';
  }
  A.actions['local-build'] = function (el) {
    var l = A.state.dev.local.filter(function (x) { return x.id === el.dataset.id; })[0];
    building[l.id] = { pct: 5 };
    A.refresh();
    var timer = setInterval(function () {
      var b = building[l.id];
      b.pct = Math.min(100, b.pct + 18);
      var node = document.querySelector('[data-build="' + l.id + '"] i');
      if (node) node.style.width = b.pct + '%';
      if (b.pct >= 100) {
        clearInterval(timer); delete building[l.id];
        l.index = { at: A.now(), files: '1,302' };
        A.save(); if (A.route.page === 'local') A.refresh(); A.toast('索引已建立：' + l.name);
      }
    }, 500);
  };
  A.actions['local-apply'] = function (el) {
    var l = A.state.dev.local.filter(function (x) { return x.id === el.dataset.id; })[0];
    l.applied = true; A.save(); A.refresh(); A.toast('Code Agent 现在可以查询「' + l.name + '」');
  };
  A.actions['local-add'] = function () {
    var d = A.dialog({
      title: '添加目录',
      body: '<div class="form-body"><label class="field"><span class="label">类型</span><select data-type><option value="repo">代码仓</option><option value="docs">文档目录</option></select></label>' +
        '<label class="field"><span class="label">目录</span><input data-path value="~/code/card-core-legacy"></label>' +
        '<label class="field"><span class="label">名称</span><input data-name value="card-core-legacy"></label></div>',
      foot: '<button data-cancel>取消</button><button class="primary" data-ok>添加</button>'
    });
    d.el.querySelector('[data-path]').addEventListener('input', function () { d.el.querySelector('[data-name]').value = this.value.split('/').pop(); });
    d.el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    d.el.querySelector('[data-ok]').onclick = function () {
      var path = d.el.querySelector('[data-path]').value.trim(); if (!path) return;
      var type = d.el.querySelector('[data-type]').value, name = d.el.querySelector('[data-name]').value.trim() || path.split('/').pop();
      var repo = A.state.sources.filter(function (s) { return s.type === 'repo' && s.name === name; })[0];
      A.state.dev.local.push({ id: A.uid('l'), type: type, name: name, path: path, repo: repo ? repo.id : null, index: null, applied: false });
      A.save(); d.close(); A.refresh(); A.toast('已添加「' + name + '」');
    };
  };
  A.pages.local = { title: '本地索引', role: 'dev', render: render };
})();
