// Boot: load state from the Talents service, route by hash, switch between the admin and developer entries.
// Teams links here as /talents?role=owner|member#/<page>?project=<id>; the role picks the entry.
(function () {
  var A = App;
  function route() {
    A.closeAll();
    A.route = A.parseHash();
    A.render();
    window.scrollTo(0, 0);
  }
  A.actions['switch-role'] = function (el) {
    if (A.state.role === el.dataset.role) return;
    A.state.role = el.dataset.role; A.save();
    location.hash = '#/' + A.home[A.state.role];
  };
  var menu = document.querySelector('[data-menu]');
  A.actions['toggle-menu'] = function () { menu.hidden = !menu.hidden; };
  document.addEventListener('click', function (e) { if (!e.target.closest('.menu-wrap')) menu.hidden = true; });
  A.actions['reset-demo'] = function () {
    menu.hidden = true;
    A.confirm('重置数据？', '新登记的本地文档来源、任务、修订、发布和应用记录会被清除，恢复到初始状态。团队、成员和项目来自 iCode Teams，不受影响。', '重置', true).then(function (ok) {
      if (!ok) return;
      A.reset().then(function () {
        location.hash = '#/' + A.home[A.state.role];
        route();
        A.toast('已恢复初始数据');
      }, function (e) { A.toast('重置失败：' + e.message); });
    });
  };

  A.load().then(function () {
    var role = new URLSearchParams(location.search).get('role');
    var entry = role === 'owner' ? 'admin' : role === 'member' ? 'dev' : null;
    if (entry && entry !== A.state.role) { A.state.role = entry; A.save(); }
    if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#/' + A.home[A.state.role]);
    window.addEventListener('hashchange', route);
    route();
    if (A.teams.from === 'none') A.toast('还没有读取到 iCode Teams 的数据，请先启动 Teams');
  }, function (e) {
    document.getElementById('app').innerHTML = '<div class="empty boot-error"><b>无法连接 Talents 服务</b><span>' + A.esc(e.message) +
      '。请在 talents 目录运行 npm run dev，然后刷新页面。</span></div>';
  });
})();
