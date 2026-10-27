// 知识能力：按四类展示 Talents 提供的知识生成能力。
(function () {
  var A = App, esc = A.esc;

  function card(c) {
    var used = A.state.tasks.filter(function (t) { return t.cap === c.id; }).length;
    return '<article class="card cat-' + c.cat + '">' +
      '<div class="card-head"><span class="icon">' + A.capIcon(c) + '</span><div class="grow"><h3>' + esc(c.name) + '</h3><p class="ui-note">' + esc(c.desc) + '</p></div></div>' +
      '<dl class="fields"><dt>输入</dt><dd>' + esc(c.inputLabel) + '</dd><dt>产出</dt><dd>' + esc(c.output) + '</dd>' +
      '<dt>更新</dt><dd>' + (c.update ? esc(c.update) : '<span class="ui-note">不支持，' + esc(c.noUpdate || '每次运行重新构建') + '</span>') + '</dd></dl>' +
      '<div class="card-foot"><span class="caption">' + (used ? used + ' 个任务在用' : '尚未使用') + '</span>' +
      '<button data-action="cap-new-task" data-id="' + c.id + '">新建任务</button></div></article>';
  }

  function render() {
    return '<header class="page-heading"><div><h1>知识能力</h1><p class="ui-note">每种能力把一类来源变成 Agent 用得上的知识。能力负责首次构建；支持更新的能力，在来源变化后只处理变化的部分。</p></div></header>' +
      A.state.categories.map(function (cat) {
        var caps = A.state.capabilities.filter(function (c) { return c.cat === cat.id; });
        return '<section class="category cat-' + cat.id + '"><div class="category-title"><h2><span class="cat-dot"></span>' + esc(cat.name) + '</h2>' +
          '<p class="ui-note">' + esc(cat.desc) + '</p></div>' +
          '<div class="cap-grid">' + caps.map(card).join('') + '</div></section>';
      }).join('');
  }

  A.actions['cap-new-task'] = function (el) { A.go('#/tasks?new=1&cap=' + el.dataset.id); };
  A.pages.capabilities = { title: '知识能力', role: 'admin', render: render };
})();
