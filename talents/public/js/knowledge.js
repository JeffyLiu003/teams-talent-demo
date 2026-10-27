// Knowledge artifacts: versions (published / original draft / current revision), file contents,
// diff, preview, and what applying to iCode would write on the developer's machine.
window.K = (function () {
  var A = App, esc = A.esc;
  var K = {};
  var TALENTS_HOME = '~/.icode-talents';
  var SKILL_DIRS = { chrys: '~/.chrys/skills', agents: '~/.agents/skills' };
  var TEAM_MCP = 'talents-team';

  K.isIndex = function (a) { return a.kind === 'index'; };
  K.kind = function (a) { return a.kind === 'index' ? 'mcp' : a.cap === 'traj' ? 'memory' : 'skill'; };
  K.kindLabel = { mcp: '在线查询（MCP）', skill: 'Skill', memory: '经验规则' };
  K.deliveryLabel = { local: '同步到本地', cloud: '云端查询' };
  K.status = function (a) {
    if (a.published && a.draft) return 'update';
    if (a.published) return 'published';
    return 'draft';
  };
  K.adminBadge = function (a) {
    var st = K.status(a);
    if (st === 'draft') return '<span class="badge warning">待审阅</span>';
    if (st === 'update') return '<span class="badge warning">新版本待审阅</span>';
    return '<span class="badge success">已发布 v' + a.published.version + '</span>';
  };

  // ---------- Files and versions ----------
  K.files = function (a, which) { return which === 'published' && a.published ? (a.published.files || a.files || []) : (a.files || []); };
  K.specsOf = function (a, which) { return which === 'published' && a.published ? (a.published.specs || a.specs) : a.specs; };
  K.minerIndex = function (specs) {
    var text = A.content('miner/index.md') || '';
    var rows = {};
    text.split(/\r?\n/).forEach(function (l) { var m = /^\|\s*\[([^\]]+)\]/.exec(l); if (m) rows[m[1]] = l; });
    var head = text.split(/\r?\n/).filter(function (l) { return /^#|^>/.test(l); }).join('\n');
    return head + '\n\n| 名称 | 描述 | 首次归档时间 |\n| --- | --- | --- |\n' + (specs || []).map(function (n) { return rows[n] || '| [' + n + '](<./' + n + '/summary.md>) | — | — |'; }).join('\n') + '\n';
  };
  function baseText(a, which, key) {
    if (key === 'miner/index.md') return K.minerIndex(K.specsOf(a, which));
    if (which === 'published' && a.published && a.published.over && a.published.over[key]) {
      var o = a.published.over[key];
      return o.text != null ? o.text : A.content(o);
    }
    return A.content(key);
  }
  // which: 'published' | 'original' (as the capability produced it) | 'current' (after revisions)
  K.text = function (a, which, key) {
    if (which === 'current' && a.draft) {
      for (var i = a.draft.revisions.length - 1; i >= 0; i--) if (a.draft.revisions[i].file === key) return a.draft.revisions[i].text;
    }
    return baseText(a, which === 'published' ? 'published' : 'original', key);
  };
  // The report names the session it focuses on; when several sessions were analysed, say so.
  K.reportHtml = function (a, html) {
    if (!a.sessions || !html) return html;
    var main = A.session(a.sessions[0]);
    var topic = A.state.trajTopics[a.topic];
    var line = a.sessions.length > 1
      ? '分析了 ' + a.sessions.length + ' 个会话，其中与「' + topic.title + '」相关的问题最典型，以下是该会话的诊断。'
      : null;
    if (!line) return html;
    return html.replace(/<p class="small">[\s\S]*?<\/p>/, function (m) { return '<p class="small">' + esc(line) + '</p>' + m; });
  };
  K.fileLabel = function (key) {
    var parts = key.split('/');
    var name = parts.pop();
    if (name === 'summary.md') return '范式总结';
    if (name === 'analyzer.md') return '代码分析报告';
    if (name === 'metadata.json') return 'PR #' + parts.pop();
    if (name === 'index.md') return parts[0] === 'miner' ? '范式索引' : '索引';
    if (/^Skill改进-/.test(name)) return 'Skill 改进：' + name.replace(/^Skill改进-|\.md$/g, '');
    return name.replace(/\.(md|html)$/, '');
  };
  // Miner artifacts list files per spec: 范式总结, 代码分析报告, then the PR records.
  K.fileGroups = function (a, files) {
    if (a.folder !== 'miner') return [{ title: '', items: files }];
    var groups = [{ title: '', items: files.filter(function (f) { return f === 'miner/index.md'; }) }], by = {};
    files.forEach(function (f) {
      var m = /^miner\/([^/]+)\//.exec(f);
      if (!m) return;
      if (!by[m[1]]) { by[m[1]] = { title: m[1], items: [] }; groups.push(by[m[1]]); }
      by[m[1]].items.push(f);
    });
    return groups;
  };
  function prRecord(text) {
    var pr;
    try { pr = JSON.parse(text); } catch (e) { return '<pre class="plain">' + esc(text) + '</pre>'; }
    return '<article class="markdown"><h1>PR #' + pr.number + ' ' + esc(pr.title) + '</h1>' +
      '<dl class="fields"><dt>状态</dt><dd>已合并' + (pr.mergedAt ? '，' + esc(String(pr.mergedAt).replace('T', ' ').slice(0, 16)) : '') + '</dd>' +
      (pr.author ? '<dt>作者</dt><dd>' + esc(pr.author) + '</dd>' : '') + '<dt>链接</dt><dd class="path">' + esc(pr.url || '') + '</dd></dl>' +
      A.markdown(pr.body || '') + '<p class="caption">diff 未随产物保存，需要时用 <code>git show</code> 或打开 PR 链接查看。</p></article>';
  }
  K.renderText = function (a, key, text) {
    if (text == null) return '<div class="index-summary"><p class="ui-note">内容暂不可预览。</p></div>';
    if (/\/input\/prs\/\d+\/metadata\.json$/.test(key)) return prRecord(text);
    if (/\.html$/.test(key)) return '<iframe title="预览" sandbox="" srcdoc="' + esc(K.reportHtml(a, text)) + '"></iframe>';
    if (/\.md$/.test(key)) return '<article class="markdown">' + A.markdown(text) + '</article>';
    return '<pre class="plain">' + esc(text) + '</pre>';
  };
  K.indexSummary = function (a) {
    return '<div class="index-summary"><div class="stat-row">' + a.stats.map(function (s) { return '<div class="stat"><b>' + esc(s[1]) + '</b><span>' + esc(s[0]) + '</span></div>'; }).join('') + '</div>' +
      '<p>' + esc(a.desc) + '</p><p class="ui-note">索引通过在线查询使用，不需要打开阅读。</p></div>';
  };

  // ---------- Diff ----------
  K.diffLines = function (oldText, newText) {
    var a = (oldText || '').split(/\r?\n/), b = (newText || '').split(/\r?\n/);
    if (!oldText) a = [];
    var n = a.length, m = b.length, i, j;
    var dp = [];
    for (i = 0; i <= n; i++) { dp.push(new Int32Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push([' ', a[i]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['-', a[i]]); i++; }
      else { ops.push(['+', b[j]]); j++; }
    }
    while (i < n) ops.push(['-', a[i++]]);
    while (j < m) ops.push(['+', b[j++]]);
    return ops;
  };
  K.diffStats = function (ops) {
    var s = { add: 0, del: 0 };
    ops.forEach(function (o) { if (o[0] === '+') s.add++; else if (o[0] === '-') s.del++; });
    return s;
  };
  K.diffHtml = function (oldText, newText) {
    var ops = K.diffLines(oldText, newText);
    var st = K.diffStats(ops);
    if (!st.add && !st.del) return '<div class="diff-empty">没有差异</div>';
    var keep = ops.map(function () { return false; });
    ops.forEach(function (o, k) { if (o[0] !== ' ') for (var d = -3; d <= 3; d++) if (ops[k + d]) keep[k + d] = true; });
    var out = [], gap = false;
    ops.forEach(function (o, k) {
      if (!keep[k]) { if (!gap) { out.push('<div class="diff-gap">⋯</div>'); gap = true; } return; }
      gap = false;
      var cls = o[0] === '+' ? 'add' : o[0] === '-' ? 'del' : 'ctx';
      out.push('<div class="diff-line ' + cls + '"><span class="sign">' + (o[0] === ' ' ? '' : o[0]) + '</span><span>' + (esc(o[1]) || '&nbsp;') + '</span></div>');
    });
    return '<div class="diff-summary"><span class="add">+' + st.add + '</span> <span class="del">−' + st.del + '</span> 行</div><div class="diff">' + out.join('') + '</div>';
  };

  // ---------- Preview (published version, read-only) ----------
  K.preview = function (a, opts) {
    opts = opts || {};
    var which = opts.which || 'published';
    var cap = A.cap(a.cap);
    if (K.isIndex(a)) {
      A.dialog({ eyebrow: esc(cap.name), title: esc(a.name), headActions: opts.headActions || '', body: K.indexSummary(a) });
      return;
    }
    var files = K.files(a, which);
    var groups = K.fileGroups(a, files).map(function (g, i) {
      return { title: g.title || (i ? '' : '内容'), items: g.items.map(function (f) { return { key: f, label: K.fileLabel(f), indent: !!g.title && a.folder === 'miner' }; }) };
    });
    (a.skills || []).forEach(function (name) {
      groups.push({ title: '配套 Skill：' + name, skill: true, items: A.skillTree(name).map(function (f) { return { key: 'skills/' + name + '/' + f, label: f, indent: f.indexOf('/') > 0 }; }) });
    });
    var first = files.filter(function (f) { return !/index\.md$/.test(f); })[0] || files[0];
    var list = groups.map(function (g) {
      return (g.title ? '<div class="file-group">' + esc(g.title) + '</div>' : '') + g.items.map(function (it) {
        return '<button class="file-item' + (it.indent ? ' indent' : '') + '" data-key="' + esc(it.key) + '"' + (it.key === first ? ' aria-current="true"' : '') + '>' + esc(it.label) + '</button>';
      }).join('');
    }).join('');
    var d = A.dialog({
      className: 'large', eyebrow: esc(cap.name), title: esc(a.name), headActions: opts.headActions || '',
      body: '<div class="preview-body"><nav class="file-list" aria-label="文件">' + list + '</nav><div class="preview-content" data-view></div></div>'
    });
    d.body.style.display = 'flex';
    function show(key) {
      var text = /^skills\//.test(key) ? A.content(key) : K.text(a, which, key);
      var v = d.el.querySelector('[data-view]');
      v.innerHTML = K.renderText(a, key, text); v.scrollTop = 0;
    }
    K.bindFileList(d.el, show);
    show(first);
    return d;
  };
  // File list clicks, plus relative links inside markdown that point at another file in the list.
  K.bindFileList = function (root, show) {
    root.querySelector('.file-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-key]'); if (!b) return;
      root.querySelectorAll('.file-item').forEach(function (x) { x.removeAttribute('aria-current'); });
      b.setAttribute('aria-current', 'true');
      show(b.dataset.key);
    });
    root.addEventListener('click', function (e) {
      var link = e.target.closest('.markdown a[href]'); if (!link) return;
      var href = decodeURIComponent(link.getAttribute('href')).replace(/^<|>$/g, '').replace(/^\.\//, '');
      if (/^https?:/.test(href)) return;
      e.preventDefault();
      var cur = root.querySelector('.file-item[aria-current]');
      var target = (cur ? cur.dataset.key.replace(/[^/]*$/, '') : '') + href;
      var btn = Array.prototype.filter.call(root.querySelectorAll('.file-item'), function (x) { return x.dataset.key === target; })[0];
      if (btn) btn.click();
    });
  };

  // ---------- Applying on the developer's machine ----------
  K.rules = function (a) {
    var text = A.content('trajectory/' + a.topic + '/改进建议.md') || '';
    var out = [], re = /^\d+\.\s+\*\*(.+?)\*\*/gm, m;
    while ((m = re.exec(text))) out.push(m[1]);
    return out;
  };
  K.localRepos = function (a) {
    // Local clones of this project's code repositories.
    var pid = a.published && a.published.project;
    var repoIds = pid ? A.projectRepos(pid).map(function (r) { return r.id; }) : [];
    return A.state.dev.local.filter(function (l) { return l.type === 'repo' && repoIds.indexOf(l.repo) >= 0; });
  };
  K.scopeOptions = function (a) {
    var k = K.kind(a);
    return {
      repo: k === 'mcp' ? '索引通过智能体的在线查询使用，只能应用到指定智能体' : (K.localRepos(a).length ? '' : '本机还没有这个项目的代码仓'),
      global: k === 'mcp' ? '索引通过智能体的在线查询使用，只能应用到指定智能体' : k === 'memory' ? '经验规则只能写入代码仓或指定智能体' : '',
      agent: ''
    };
  };
  K.defaultScope = function (a) {
    var k = K.kind(a);
    if (k === 'mcp') return { kind: 'agent', agents: ['Code'] };
    var repos = K.localRepos(a);
    if (repos.length) return { kind: 'repo', repos: repos.map(function (r) { return r.repo; }) };
    return k === 'memory' ? { kind: 'agent', agents: ['Code'] } : { kind: 'global', dir: 'chrys' };
  };
  function localPath(repoId) {
    var l = A.state.dev.local.filter(function (x) { return x.repo === repoId; })[0];
    return l ? l.path : A.source(repoId).path;
  }
  K.scopeText = function (scope) {
    if (scope.kind === 'repo') return scope.repos.map(function (id) { return A.source(id).name; }).join('、');
    if (scope.kind === 'global') return '所有智能体';
    return scope.agents.map(function (id) { return A.agent(id).name; }).join('、');
  };
  K.sentence = function (a, scope) {
    var k = K.kind(a), target = K.scopeText(scope);
    if (k === 'mcp') return '在 ' + target + ' 中可以在线查询「' + a.name + '」。';
    if (k === 'memory') return '把 ' + K.rules(a).length + ' 条经验规则加入 ' + target + ' 的记忆，并按建议更新 Skill「' + a.skillPatch + '」。';
    var how = a.published && a.published.delivery === 'cloud' ? '在线查询' : '同步到本机';
    return '「' + a.name + '」' + how + '，在 ' + target + ' 中可用' + (a.skills ? '，配套 Skill「' + a.skills.join('、') + '」' : '') + '。';
  };
  function block(title, lines) {
    return ['<!-- icode-talents:begin -->', '## ' + title + '（由 iCode Talents 维护）'].concat(lines).concat(['<!-- icode-talents:end -->']).map(function (l) { return '+ ' + l; });
  }
  function mcpLines() {
    return ['tools:', '  mcp:', '+   - name: ' + TEAM_MCP, '+     transport: http', '+     url: https://talents.bank.local/mcp', '+     headers:', '+       Authorization: "Bearer {{TALENTS_TOKEN}}"'];
  }
  function specLines(a) {
    if (a.folder !== 'miner') return K.files(a, 'published').map(function (f) { return f.split('/').slice(-2).join('/'); });
    return ['index.md'].concat((K.specsOf(a, 'published') || []).map(function (n) { return n + '/（范式总结、代码分析报告、PR 资料）'; }));
  }
  K.changes = function (a, scope) {
    var files = {}, order = [];
    function add(path, verb, lines) {
      if (!files[path]) { files[path] = { verb: verb, lines: [] }; order.push(path); }
      files[path].lines = files[path].lines.concat(lines || []);
    }
    var project = A.project(a.published ? a.published.project : 'p-card');
    var knowledgeDir = TALENTS_HOME + '/knowledge/' + project.name + '/' + (a.folder || '') + '/';
    var cloud = !a.published || a.published.delivery === 'cloud' || K.isIndex(a);
    var agents = scope.kind === 'agent' ? scope.agents : A.state.agents.map(function (g) { return g.id; });
    var k = K.kind(a);
    var where = cloud ? '通过 MCP 工具 `' + TEAM_MCP + '.search` 查询（知识：' + a.name + '）' : '`' + knowledgeDir + '`';
    var line = '- ' + a.name + '：' + where + '。' + (a.usage || a.desc) + (a.skills ? '；配套 Skill ' + a.skills.join('、') + '。' : '');

    if (cloud) agents.forEach(function (g) { add('~/.chrys/agents/' + g + '.yaml', '更新', mcpLines()); });
    var inRepo = a.folder === 'miner' && scope.kind === 'repo';
    if (inRepo) {
      knowledgeDir = '<代码仓>/.icode-knowledge/miner/';
      line = '- ' + a.name + '：`.icode-knowledge/miner/`（先读 index.md）。' + (a.usage || a.desc) + '。';
    }
    if (!cloud && k !== 'memory' && !inRepo) add(knowledgeDir, '新增', specLines(a));

    if (k === 'memory') {
      var rules = K.rules(a).map(function (r) { return '- ' + r; });
      var patch = (A.content('trajectory/' + a.topic + '/Skill改进-' + a.skillPatch + '.md') || '').split(/\r?\n/)
        .filter(function (l) { return /^\+/.test(l); }).map(function (l) { return '+ ' + l.slice(1).trim(); });
      if (scope.kind === 'repo') scope.repos.forEach(function (rid) {
        add(localPath(rid) + '/AGENTS.md', '更新', block('经验规则', rules));
        add(localPath(rid) + '/.agents/skills/' + a.skillPatch + '/SKILL.md', '更新', patch);
      });
      else {
        add(TALENTS_HOME + '/memory/经验规则.md', '新增', rules.map(function (l) { return '+ ' + l; }));
        agents.forEach(function (g) { add('~/.chrys/agents/' + g + '.yaml', '更新', ['memory:', '  files:', '+   - ' + TALENTS_HOME + '/memory/经验规则.md']); });
        add(SKILL_DIRS.chrys + '/' + a.skillPatch + '/SKILL.md', '更新', patch);
      }
    } else if (scope.kind === 'repo') {
      scope.repos.forEach(function (rid) {
        var root = localPath(rid);
        if (inRepo && !cloud) add(root + '/.icode-knowledge/miner/', '新增', specLines(a));
        (a.skills || []).forEach(function (sk) { add(root + '/.agents/skills/' + sk + '/', '新增', ['Skill，' + A.skillTree(sk).length + ' 个文件']); });
        add(root + '/AGENTS.md', '更新', block('项目知识', [line]));
      });
    } else {
      var skillRoot = scope.kind === 'global' ? SKILL_DIRS[scope.dir] : TALENTS_HOME + '/skills';
      (a.skills || []).forEach(function (sk) { add(skillRoot + '/' + sk + '/', '新增', ['Skill，' + A.skillTree(sk).length + ' 个文件']); });
      add(TALENTS_HOME + '/knowledge-index.md', '更新', ['+ ' + line]);
      agents.forEach(function (g) {
        var lines = [];
        if (scope.kind === 'agent' && a.skills) lines = lines.concat(['skills:', '  paths:']).concat(a.skills.map(function (sk) { return '+   - ' + skillRoot + '/' + sk; }));
        lines = lines.concat(['memory:', '  files:', '+   - ' + TALENTS_HOME + '/knowledge-index.md']);
        add('~/.chrys/agents/' + g + '.yaml', '更新', lines);
      });
    }
    order.forEach(function (path) {
      if (!/\.yaml$/.test(path)) return;
      var seen = {}, merged = [];
      files[path].lines.forEach(function (l) { if (/^\+/.test(l)) { if (!seen[l]) { seen[l] = 1; merged.push(l); } } else if (!seen[l]) { seen[l] = 1; merged.push(l); } });
      files[path].lines = merged;
    });
    return order.map(function (path) {
      var f = files[path];
      return '<div class="change"><div class="change-head"><span class="badge ' + (f.verb === '新增' ? 'success' : 'primary') + '">' + f.verb + '</span><span class="path">' + esc(path) + '</span></div>' +
        '<pre>' + f.lines.map(function (l) { return /^\+/.test(l) ? '<span class="add">' + esc(l) + '</span>' : esc(l); }).join('\n') + '</pre></div>';
    }).join('');
  };

  return K;
})();
