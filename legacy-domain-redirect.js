/* Client-side fallback for the legacy GitHub Pages hostname. This is not an HTTP 301. */
(function () {
  if (window.location.hostname.toLowerCase() !== 'hayyze.github.io') return;
  window.location.replace(
    'https://hayyze.pages.dev' +
    window.location.pathname +
    window.location.search +
    window.location.hash
  );
})();
