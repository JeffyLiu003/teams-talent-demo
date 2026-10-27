// Boot: load state, route by hash, switch between the admin and developer entries.
(function () {
  var A = App;
  A.load();
  function route() {
    A.closeAll();
    A.route = A.parseHash();
    A.render();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
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
    A.confirm('重置数据？', '新建的来源、任务、修订和应用记录会被清除，恢复到初始状态。', '重置', true).then(function (ok) {
      if (!ok) return;
      A.reset();
      location.hash = '#/' + A.home[A.state.role];
      route();
      A.toast('已恢复初始数据');
    });
  };
  if (!location.hash) history.replaceState(null, '', '#/' + A.home[A.state.role]);
  route();
})();
