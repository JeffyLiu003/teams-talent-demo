// Runs before the stylesheets so the first frame already has the right theme.
(function () {
  var media = matchMedia('(prefers-color-scheme: dark)');
  var choice = 'system';
  try { choice = localStorage.getItem('talents.theme') || 'system'; } catch (e) { /* storage unavailable */ }
  if (['light', 'dark', 'system'].indexOf(choice) < 0) choice = 'system';
  function apply() {
    document.documentElement.dataset.theme = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
  }
  apply();
  media.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', function () {
    var select = document.querySelector('#theme');
    select.value = choice;
    select.addEventListener('change', function () {
      choice = select.value;
      try { localStorage.setItem('talents.theme', choice); } catch (e) { /* this session only */ }
      apply();
    });
  });
})();
