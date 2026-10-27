// 产物审阅：待审阅 / 已发布列表，以及整页的审阅工作台（内容、对比、对话修订、手动编辑、发布）。
(function () {
  var A = App, esc = A.esc;

  // ---------- List ----------
  // Published knowledge whose source changed after it was built; the capability must be able to update.
  function staleChanges(a) {
    if (a.draft || !A.cap(a.cap).update) return null;
    var c = A.changesSince(A.source(a.sources[0]), A.basisOf(a));
    return c && c.count ? c : null;
  }
  function staleNote(a, c) {
    var src = A.source(a.sources[0]);
    var range = src.type === 'docs' ? A.versionLabel(c.from) + ' → ' + A.versionLabel(c.to) + '，' : '';
    return '<div class="update-note"><b>' + (src.type === 'docs' ? '提取后文档有变化' : '构建后代码有变化') + '</b><span class="caption">' + esc(range + c.text) + '</span></div>';
  }
  function card(a) {
    var cap = A.cap(a.cap), st = K.status(a), stale = staleChanges(a);
    var when = st === 'published' ? (a.published.auto ? '自动发布于 ' : '发布于 ') + A.when(a.published.at) : '生成于 ' + A.when(a.draft.created);
    return '<article class="card clickable cat-' + cap.cat + '" data-action="open-review" data-id="' + a.id + '">' +
      '<div class="card-head"><span class="icon">' + A.capIcon(cap) + '</span><div class="grow"><h3>' + esc(a.name) + '</h3><span class="cat-label">' + esc(cap.name) + '</span></div>' + K.adminBadge(a) + '</div>' +
      '<p class="ui-note">' + esc(a.desc) + '</p>' + (stale ? staleNote(a, stale) : '') +
      '<div class="card-foot"><span class="caption">' + esc(when) + '</span><div class="actions">' +
      (stale ? '<button data-action="re-extract" data-id="' + a.id + '">重新提取</button>' : '') +
      '<button' + (st === 'published' ? '' : ' class="primary"') + '>' + (st === 'published' ? '查看' : '审阅') + '</button></div></div></article>';
  }
  // Re-extract opens the task form prefilled from the task that built this artifact; it does not start a run.
  A.actions['re-extract'] = function (el, e) {
    if (e) e.stopPropagation();
    A.go('#/tasks?new=1&from=' + el.dataset.id);
  };
  function basisLine(a, basis) {
    var src = A.source(a.sources[0]);
    if (!basis || !src) return '';
    return '<dt>基于</dt><dd>' + esc(src.name) + '，' + esc(basis.version ? A.versionLabel(basis.version) : '提交 ' + basis.commit) + '</dd>';
  }
  function renderList() {
    var pending = A.state.artifacts.filter(function (a) { return a.draft; });
    var done = A.state.artifacts.filter(function (a) { return !a.draft; });
    function section(title, note, list) {
      return '<section class="section"><div class="section-head"><h2>' + title + '</h2><span class="ui-note">' + note + '</span></div>' +
        (list.length ? '<div class="grid">' + list.map(card).join('') + '</div>' : '<div class="empty">没有需要审阅的产物</div>') + '</section>';
    }
    return '<header class="page-heading"><div><h1>产物审阅</h1><p class="ui-note">审阅知识任务的产出，修订满意后发布到团队空间。开发者只能看到已发布的内容。</p></div></header>' +
      section('待审阅', pending.length + ' 个', pending) + (done.length ? section('已发布', done.length + ' 个', done) : '');
  }
  A.actions['open-review'] = function (el) { A.go('#/review?id=' + el.dataset.id); };

  // ---------- Workbench ----------
  var wb = null; // { id, file, tab: 'content'|'diff', base: 'published'|'original', side: 'chat'|'edit', chat: [] }
  var CHAT_SCRIPTS = [
    { file: /业务规则目录/, match: /BR-POST-03|超限|102|本期借/,
      prompt: 'BR-POST-03 的公式少了“本期借”，请对照 CBTRN02C 修正',
      edit: function (text) {
        return text.split('\n').map(function (l) {
          if (l.indexOf('BR-POST-03') < 0 || l.indexOf('|') !== 0) return l;
          l = l.replace(/本期贷\s*\+\s*本笔/, '本期贷 − 本期借 + 本笔');
          return l.indexOf('证据') >= 0 ? l : l.replace(/(OVERLIMIT TRANSACTION`)/, '$1（证据：`CBTRN02C.cbl:403-413`）');
        }).join('\n');
      },
      summary: '修正 BR-POST-03 的超限公式',
      reply: '已对照 CBTRN02C.cbl:403-413 修正 BR-POST-03：超限公式补上“− 本期借”，与存量程序一致。其他规则没有改动。' },
    { file: /改进建议/, match: /基线|第 ?3 ?条|绝对|确认/,
      prompt: '第 3 条规则太绝对，改成“修改比对基线前须说明证据并经人确认”',
      edit: function (text) {
        return text.replace(/^3\.\s+\*\*[^*]+\*\*/m, '3. **修改比对基线前，须说明证据并经人确认。**');
      },
      summary: '放宽第 3 条经验规则',
      reply: '已改写第 3 条规则：允许修改比对基线，但要求先说明存量代码证据并经人确认。' }
  ];
  function scriptsFor(file) { return CHAT_SCRIPTS.filter(function (s) { return s.file.test(file); }); }
  function isMd(key) { return /\.md$/.test(key); }

  function ensure(id) {
    if (!wb || wb.id !== id) {
      var a = A.artifact(id);
      wb = { id: id, file: a && !K.isIndex(a) ? (K.files(a, a.draft ? 'current' : 'published').filter(function (f) { return !/index\.md$/.test(f); })[0] || a.files[0]) : null,
        tab: 'content', base: a && a.published && a.draft ? 'published' : 'original', side: 'chat', chat: [] };
    }
    return A.artifact(id);
  }
  function viewWhich(a) { return a.draft ? 'current' : 'published'; }
  function changed(a, key) {
    if (!a.draft || !isMd(key)) return '';
    var base = K.text(a, wb.base, key);
    var cur = K.text(a, 'current', key);
    if (base == null || (wb.base === 'published' && K.files(a, 'published').indexOf(key) < 0)) return '<span class="mark new">新</span>';
    return base !== cur ? '<span class="mark">改</span>' : '';
  }
  function renderMain(a) {
    if (K.isIndex(a)) return K.indexSummary(a);
    var key = wb.file;
    if (wb.tab === 'diff' && a.draft) {
      if (!isMd(key)) return '<div class="index-summary"><p class="ui-note">这个文件不支持对比，请切换到“内容”查看。</p></div>';
      var base = wb.base === 'published' && K.files(a, 'published').indexOf(key) < 0 ? '' : K.text(a, wb.base, key);
      return '<div class="diff-wrap">' + K.diffHtml(base, K.text(a, 'current', key)) + '</div>';
    }
    return K.renderText(a, key, K.text(a, viewWhich(a), key));
  }
  function renderSide(a) {
    if (!a.draft) {
      var p = a.published;
      var stale = staleChanges(a);
      return '<div class="side-body"><h3>已发布</h3><dl class="fields"><dt>版本</dt><dd>v' + p.version + '</dd><dt>发布于</dt><dd>' + esc(p.at) + '</dd>' +
        basisLine(a, p.basis) + '<dt>交付方式</dt><dd>' + K.deliveryLabel[p.delivery] + '</dd><dt>更新说明</dt><dd>' + esc(p.note) + '</dd></dl>' +
        (stale ? staleNote(a, stale) + '<div class="actions"><button data-action="re-extract" data-id="' + a.id + '">重新提取</button></div>'
          : '<p class="caption">' + (K.isIndex(a) ? '对应的知识任务运行后会自动发布新版本。' : '重新运行对应的知识任务后，新版本会出现在“待审阅”。') + '</p>') + '</div>';
    }
    var basis = basisLine(a, a.draft.basis);
    if (K.isIndex(a)) return '<div class="side-body">' + (basis ? '<dl class="fields">' + basis + '</dl>' : '') + '<p class="ui-note">索引类产物不需要修订，确认后直接发布。发布后，之后的每次更新都会自动发布，不再需要审阅。</p></div>';
    var revs = a.draft.revisions;
    var history = '<div class="history"><div class="caption">修订记录</div><ol>' +
      '<li><b>原始产物</b><span class="caption">' + esc(A.when(a.draft.created)) + '</span></li>' +
      revs.map(function (r, i) { return '<li><b>修订 ' + (i + 1) + '（' + (r.kind === 'chat' ? '对话' : '手动') + '）</b><span class="caption">' + esc(K.fileLabel(r.file)) + '</span></li>'; }).join('') + '</ol></div>';
    var tabs = '<div class="tabs side-tabs"><button aria-pressed="' + (wb.side === 'chat') + '" data-side="chat">和 iCode 对话</button><button aria-pressed="' + (wb.side === 'edit') + '" data-side="edit">手动编辑</button></div>';
    var body;
    if (wb.side === 'chat') {
      var task = a.draft.task && A.task(a.draft.task);
      var seed = task ? task.id : a.id;
      var sid = A.hashId(seed);
      var tips = scriptsFor(wb.file).map(function (s) { return '<button data-tip="' + esc(s.prompt) + '">' + esc(s.prompt) + '</button>'; }).join('');
      body = '<p class="caption">接着挖掘时的 iCode 会话继续，会话 <code>' + sid + '</code></p>' +
        '<div class="chat" data-chat>' +
        '<div class="msg icode">告诉我哪里需要修改，我会直接修改产物，修改结果可以在“对比”中查看。</div>' +
        wb.chat.map(function (m) { return '<div class="msg ' + m.who + '">' + esc(m.text) + '</div>'; }).join('') + '</div>' +
        (tips ? '<div class="ai-examples">' + tips + '</div>' : '') +
        '<div class="chat-input"><textarea rows="2" data-say placeholder="说明需要修改的地方"></textarea><button class="primary" data-send>发送</button></div>';
    } else {
      body = isMd(wb.file)
        ? '<p class="caption">正在编辑：' + esc(K.fileLabel(wb.file)) + '</p><textarea class="editor-area" data-edit>' + esc(K.text(a, 'current', wb.file)) + '</textarea><div class="actions end"><button class="primary" data-save>保存修订</button></div>'
        : '<p class="ui-note">这个文件不能手动编辑，可以通过对话修订。</p>';
    }
    return '<div class="side-body">' + tabs + body + history + '</div>';
  }
  function renderWorkbench(params) {
    var a = ensure(params.id);
    if (!a) return '<div class="empty">找不到这个产物。<a href="#/review">返回产物审阅</a></div>';
    var cap = A.cap(a.cap);
    var which = viewWhich(a);
    var files = K.isIndex(a) ? [] : K.files(a, which);
    var compareCtl = a.draft && !K.isIndex(a)
      ? '<div class="tabs"><button aria-pressed="' + (wb.tab === 'content') + '" data-tab="content">内容</button><button aria-pressed="' + (wb.tab === 'diff') + '" data-tab="diff">对比</button></div>' +
        (wb.tab === 'diff' ? '<select data-base>' + (a.published ? '<option value="published"' + (wb.base === 'published' ? ' selected' : '') + '>与线上版本（v' + a.published.version + '）对比</option>' : '') +
          '<option value="original"' + (wb.base === 'original' ? ' selected' : '') + '>与原始产物对比</option></select>' : '')
      : '';
    return '<div class="wb">' +
      '<header class="wb-head"><a href="#/review" class="back">← 产物审阅</a><div class="grow"><h1>' + esc(a.name) + '</h1><span class="cat-label cat-' + cap.cat + '">' + esc(cap.name) + '</span></div>' +
      K.adminBadge(a) + (a.draft ? '<button class="primary" data-publish>发布</button>' : '') + '</header>' +
      '<div class="wb-body' + (K.isIndex(a) ? ' no-files' : '') + '">' +
      (files.length ? '<nav class="file-list" aria-label="文件">' + K.fileGroups(a, files).map(function (g) {
        return (g.title ? '<div class="file-group">' + esc(g.title) + '</div>' : '') + g.items.map(function (f) {
          return '<button class="file-item' + (g.title ? ' indent' : '') + '" data-key="' + esc(f) + '"' + (f === wb.file ? ' aria-current="true"' : '') + '>' + esc(K.fileLabel(f)) + changed(a, f) + '</button>';
        }).join('');
      }).join('') + '</nav>' : '') +
      '<section class="wb-main"><div class="wb-toolbar">' + compareCtl + '</div><div class="wb-view" data-view>' + renderMain(a) + '</div></section>' +
      '<aside class="wb-side">' + renderSide(a) + '</aside></div></div>';
  }
  function mountWorkbench(container, params) {
    var a = A.artifact(params.id);
    if (!a) return;
    var root = container.querySelector('.wb');
    root.addEventListener('click', function (e) {
      var f = e.target.closest('.file-item'); if (f) { wb.file = f.dataset.key; A.refresh(); return; }
      var t = e.target.closest('[data-tab]'); if (t) { wb.tab = t.dataset.tab; A.refresh(); return; }
      var s = e.target.closest('[data-side]'); if (s) { wb.side = s.dataset.side; A.refresh(); return; }
      var tip = e.target.closest('[data-tip]'); if (tip) { root.querySelector('[data-say]').value = tip.dataset.tip; send(); return; }
      if (e.target.closest('[data-send]')) { send(); return; }
      if (e.target.closest('[data-save]')) { save(); return; }
      if (e.target.closest('[data-publish]')) { publish(a); return; }
      var link = e.target.closest('.markdown a[href]');
      if (link) {
        var href = decodeURIComponent(link.getAttribute('href')).replace(/^<|>$/g, '').replace(/^\.\//, '');
        if (/^https?:/.test(href)) return;
        e.preventDefault();
        var target = wb.file.replace(/[^/]*$/, '') + href;
        if (a.files.indexOf(target) >= 0) { wb.file = target; A.refresh(); }
      }
    });
    var base = root.querySelector('[data-base]');
    if (base) base.onchange = function () { wb.base = base.value; A.refresh(); };
    var say = root.querySelector('[data-say]');
    if (say) say.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    var chat = root.querySelector('[data-chat]');
    if (chat) chat.scrollTop = chat.scrollHeight;

    function send() {
      var text = root.querySelector('[data-say]').value.trim();
      if (!text || wb.busy) return;
      wb.chat.push({ who: 'me', text: text });
      wb.chat.push({ who: 'icode busy', text: 'iCode 正在修改…' });
      wb.busy = true;
      A.refresh();
      setTimeout(function () {
        wb.busy = false;
        wb.chat.pop();
        var key = wb.file;
        var script = scriptsFor(key).filter(function (s) { return s.match.test(text); })[0];
        var before = K.text(a, 'current', key), after, reply;
        if (!isMd(key)) {
          reply = '这个文件是报告，不直接修改。可以切换到“改进建议”或其他文档后再提修改要求。';
        } else if (script) {
          after = script.edit(before); reply = script.reply; var summary = script.summary;
        } else {
          var lines = before.split('\n'), at = lines.findIndex(function (l) { return /^#\s/.test(l); });
          lines.splice(at + 1, 0, '', '> 审阅修订：' + text);
          after = lines.join('\n');
          reply = '已按要求修改「' + K.fileLabel(key) + '」，在开头补充了说明。可以在“对比”中查看改动。';
        }
        if (after != null && after !== before) {
          a.draft.revisions.push({ kind: 'chat', file: key, text: after, prompt: text, summary: summary || '按审阅意见修订「' + K.fileLabel(key) + '」', at: A.now() });
          wb.tab = 'diff';
          if (!a.published) wb.base = 'original';
        }
        wb.chat.push({ who: 'icode', text: reply });
        A.save(); A.refresh();
      }, 1600);
    }
    function save() {
      var text = root.querySelector('[data-edit]').value;
      if (text === K.text(a, 'current', wb.file)) { A.toast('内容没有变化'); return; }
      a.draft.revisions.push({ kind: 'manual', file: wb.file, text: text, at: A.now() });
      wb.tab = 'diff';
      A.save(); A.refresh(); A.toast('已保存修订 ' + a.draft.revisions.length);
    }
  }

  function publish(a) {
    var index = K.isIndex(a);
    var delivery = a.published ? a.published.delivery : index ? 'cloud' : 'local';
    var notes = a.draft.revisions.map(function (r) { return r.summary || '修订「' + K.fileLabel(r.file) + '」'; }).filter(function (n, i, arr) { return arr.indexOf(n) === i; });
    var defNote = a.published ? (a.folder === 'miner' && a.specs.length > (a.published.specs || []).length
      ? '新增范式「' + a.specs.filter(function (n) { return a.published.specs.indexOf(n) < 0; }).join('」「') + '」'
      : a.cap === 'doc-extract' ? '新增营销活动规则' + (notes.length ? '；' + notes.join('；') : '') : '更新内容') : '首次发布';
    var d = A.dialog({
      title: '发布到团队空间', eyebrow: esc(a.name),
      body: '<div class="form-body">' +
        '<label class="field"><span class="label">发布到</span><select data-project>' + A.state.projects.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select>' +
        '<span class="caption">该项目的成员可以在开发者端看到并应用。</span></label>' +
        '<div class="field"><span class="label">交付方式</span><div class="option-list">' +
        '<label class="option"><input type="radio" name="delivery" value="local"' + (delivery === 'local' ? ' checked' : '') + (index ? ' disabled' : '') + '><span><b>同步到本地</b><span class="caption">' + (index ? '索引需要在线查询，不能同步到本地' : '适合小而常用的知识，开发者本机保存一份') + '</span></span></label>' +
        '<label class="option"><input type="radio" name="delivery" value="cloud"' + (delivery === 'cloud' ? ' checked' : '') + '><span><b>云端查询</b><span class="caption">适合大而常变的知识，开发者的 iCode 在线查询</span></span></label></div></div>' +
        '<label class="field"><span class="label">更新说明</span><textarea rows="2" data-note>' + esc(defNote) + '</textarea><span class="caption">开发者更新时会看到这段说明。</span></label></div>',
      foot: '<button data-cancel>取消</button><button class="primary" data-ok>发布</button>'
    });
    d.el.querySelector('[data-cancel]').onclick = function () { d.close(); };
    d.el.querySelector('[data-ok]').onclick = function () {
      var btn = this; btn.classList.add('busy'); btn.disabled = true;
      setTimeout(function () {
        var over = {};
        (a.files || []).forEach(function (key) {
          var revised = a.draft.revisions.filter(function (r) { return r.file === key; }).length;
          if (revised) over[key] = { text: K.text(a, 'current', key) };
        });
        a.published = {
          version: (a.published ? a.published.version : 0) + 1, at: A.now(), note: d.el.querySelector('[data-note]').value.trim() || '更新内容',
          delivery: d.el.querySelector('input[name=delivery]:checked').value, project: d.el.querySelector('[data-project]').value,
          files: (a.files || []).slice(), specs: a.specs ? a.specs.slice() : undefined, over: over, basis: a.draft.basis || null
        };
        a.draft = null;
        wb = null;
        A.save(); d.close(); A.refresh();
        A.toast('已发布 v' + a.published.version + ' 到团队空间');
      }, 800);
    };
  }

  A.pages.review = {
    title: '产物审阅', role: 'admin',
    wide: false,
    crumb: function (p) { var a = p.id && A.artifact(p.id); return a ? '产物审阅 / ' + a.name : '产物审阅'; },
    render: function (p) { this.wide = !!p.id; return p.id ? renderWorkbench(p) : renderList(); },
    mount: function (c, p) { if (p.id) mountWorkbench(c, p); }
  };
})();
