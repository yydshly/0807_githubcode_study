(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('#themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const filterGroup = document.querySelector('#routeFilters');
  const cards = [...document.querySelectorAll('.source-card')];
  const count = document.querySelector('#routeCount');
  const empty = document.querySelector('#sourceEmpty');

  const updateTheme = () => {
    const dark = root.dataset.theme === 'dark';
    themeToggle?.setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    themeToggle?.setAttribute('aria-pressed', String(dark));
    themeMeta?.setAttribute('content', dark ? '#111510' : '#efece3');
  };

  themeToggle?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('study-theme', root.dataset.theme); } catch (_) {}
    updateTheme();
  });

  filterGroup?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    const filter = button.dataset.filter;
    filterGroup.querySelectorAll('button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    let visible = 0;
    cards.forEach((card) => {
      const show = filter === 'all' || card.dataset.tags.split(' ').includes(filter);
      card.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = `${visible} 个信息源`;
    empty.hidden = visible !== 0;
  });

  updateTheme();
})();
