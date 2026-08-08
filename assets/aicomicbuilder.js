(() => {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');

  const syncToggle = () => {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  };

  toggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('study-theme', next); } catch (_) {}
    syncToggle();
  });

  syncToggle();

  document.querySelectorAll('video').forEach((video) => {
    video.addEventListener('play', () => {
      document.querySelectorAll('video').forEach((other) => {
        if (other !== video && !other.paused) other.pause();
      });
    });
  });
})();
