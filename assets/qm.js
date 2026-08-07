(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('#themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const filterGroup = document.querySelector('#mechanismFilters');
  const cards = [...document.querySelectorAll('#mechanismGrid > article')];
  const count = document.querySelector('#mechanismCount');
  const empty = document.querySelector('#mechanismEmpty');

  const updateThemeControl = () => {
    const dark = root.dataset.theme === 'dark';
    themeToggle?.setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    themeToggle?.setAttribute('aria-pressed', String(dark));
    themeMeta?.setAttribute('content', dark ? '#101310' : '#f1eee5');
  };

  themeToggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('study-theme', next);
    } catch (_) {}
    updateThemeControl();
  });

  filterGroup?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    const active = button.dataset.filter;
    filterGroup.querySelectorAll('button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    let visible = 0;
    cards.forEach((card) => {
      const domains = card.dataset.domain?.split(' ') ?? [];
      const show = active === 'all' || domains.includes(active);
      card.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = `${visible} 项机制`;
    empty.hidden = visible !== 0;
  });

  updateThemeControl();
})();
