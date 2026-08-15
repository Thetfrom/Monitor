// TAMEYO Monitor - theme engine. Dark mode as standard: follows device, toggle overrides, remembered per device.
(function () {
  var stored = null;
  try { stored = localStorage.getItem('tmTheme'); } catch (e) {}
  var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  window.TM_DARK = dark;
  window.__tmToggle = function () {
    try { localStorage.setItem('tmTheme', window.TM_DARK ? 'light' : 'dark'); } catch (e) {}
    location.reload();
  };
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('theme-toggle');
    if (b) b.innerHTML = '<i class="ti ' + (dark ? 'ti-sun' : 'ti-moon') + '"></i>';
  });
  if (!dark) return;
  var R = [
    [/(background:\s*)(#ffffff|#fcfcff|#fff)\b/gi, '$1#1b1a27'],
    [/(background:\s*)#f7f5ff\b/gi, '$1#12111c'],
    [/(background:\s*)#faf9ff\b/gi, '$1#201f2e'],
    [/(background:\s*)(#f4f4f8|#f7f7fb)\b/gi, '$1#232231'],
    [/(background:\s*)(#f0f0f4|#f0eff8|#f0edf9|#eee9ff)\b/gi, '$1#262538'],
    [/(background:\s*)#ececf4\b/gi, '$1#28273a'],
    [/(background:\s*)#e3e4ee\b/gi, '$1#2c2b3d'],
    [/(background:\s*)#e8f7e0\b/gi, '$1#17281b'],
    [/(background:\s*)#f4fbf0\b/gi, '$1#141f12'],
    [/(background:\s*)(#fde8e8|#fdecea)\b/gi, '$1#2e1516'],
    [/(background:\s*)(#fff4e0|#fff3cd)\b/gi, '$1#2d2413'],
    [/(background:\s*)#fff3ed\b/gi, '$1#2b1d14'],
    [/(background:\s*)#b9bccb\b/gi, '$1#4a4960'],
    [/(background[-a-z]*:\s*)var\(--white\)/g, '$1#1b1a27'],
    [/(background[-a-z]*:\s*)var\(--lavender\)/g, '$1#262538'],
    [/(background[-a-z]*:\s*)var\(--rag-green-bg\)/g, '$1#17281b'],
    [/(background[-a-z]*:\s*)var\(--rag-amber-bg\)/g, '$1#2d2413'],
    [/(background[-a-z]*:\s*)var\(--rag-red-bg\)/g, '$1#2e1516'],
    [/(color:\s*)var\(--navy\)/g, '$1#eae8f6'],
    [/(color:\s*)var\(--black\)/g, '$1#eae8f6'],
    [/(color:\s*)var\(--text-secondary\)/g, '$1#a4a6b8'],
    [/(color:\s*)var\(--rag-green\)/g, '$1#83cf68'],
    [/(color:\s*)var\(--rag-amber\)/g, '$1#d9a04c'],
    [/(color:\s*)var\(--rag-red\)/g, '$1#e0796c'],
    [/var\(--border\)/g, '#2e2d3d'],
    [/(color:\s*)#0f0638\b/gi, '$1#eae8f6'],
    [/(color:\s*)#3f4157\b/gi, '$1#c3c5d4'],
    [/(color:\s*)#5c5f75\b/gi, '$1#aeb0c2'],
    [/(color:\s*)#6b6b6b\b/gi, '$1#a4a6b8'],
    [/(color:\s*)#8a8fa6\b/gi, '$1#9298ad'],
    [/(color:\s*)#a9aabb\b/gi, '$1#818699'],
    [/(color:\s*)#b9bccb\b/gi, '$1#767b90'],
    [/(color:\s*)#c9c9d6\b/gi, '$1#6b6f84'],
    [/(color:\s*)#3f9c1c\b/gi, '$1#66c649'],
    [/(color:\s*)#2f7a12\b/gi, '$1#74cf58'],
    [/(color:\s*)(#3b6d11|#2f5a0e)\b/gi, '$1#83cf68'],
    [/(color:\s*)#c0392b\b/gi, '$1#e6604e'],
    [/(color:\s*)(#a32d2d|#7a1f1f)\b/gi, '$1#e0796c'],
    [/(color:\s*)(#a86b12|#d98b0f|#856404|#7a4d05)\b/gi, '$1#d9a04c'],
    [/(color:\s*)#e8400a\b/gi, '$1#ff6a35'],
    [/solid (#eceaf5|#ececf4|#f0eff8|#e2dcf5)\b/gi, 'solid #2e2d3d'],
    [/solid (#f4f4f8|#f0f0f4)\b/gi, 'solid #262536'],
    [/solid #b9bccb\b/gi, 'solid #55596c'],
    [/solid #0f0638\b/gi, 'solid #8f88c2'],
    [/fill="#0f0638"/gi, 'fill="#d8d4f0"'],
    [/fill="#b9bccb"/gi, 'fill="#767b90"'],
    [/fill="#8a8fa6"/gi, 'fill="#9298ad"'],
    [/fill="#c9c9d6"/gi, 'fill="#6b6f84"'],
    [/stroke="#0f0638"/gi, 'stroke="#d8d4f0"'],
    [/stroke="(#f0f0f6|#f1f0f7)"/gi, 'stroke="#2e2d3d"'],
    [/stroke="#888780"/gi, 'stroke="#9a99a4"']
  ];
  var swap = function (t) {
    if (typeof t !== 'string') return t;
    if (t.indexOf('#') === -1 && t.indexOf('var(') === -1) return t;
    for (var i = 0; i < R.length; i++) t = t.replace(R[i][0], R[i][1]);
    return t;
  };
  window.__tmSwap = swap;
  document.documentElement.className += ' tm-dark';
  var hide = document.createElement('style');
  hide.id = 'tm-hide';
  hide.textContent = 'html.tm-dark{visibility:hidden}';
  document.documentElement.appendChild(hide);
  var reveal = function () { var h = document.getElementById('tm-hide'); if (h && h.parentNode) h.parentNode.removeChild(h); };
  setTimeout(reveal, 3000);
  var loadCss = function () {
    fetch('styles.css').then(function (r) { return r.text(); }).then(function (t) {
      var s = document.createElement('style');
      s.id = 'tm-dark-css';
      s.textContent = swap(t) + '\nhtml.tm-dark, html.tm-dark body{background:#12111c}';
      (document.head || document.documentElement).appendChild(s);
      reveal();
    }).catch(reveal);
  };
  if (document.head) loadCss(); else document.addEventListener('DOMContentLoaded', loadCss);
  var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (desc && desc.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true,
      get: function () { return desc.get.call(this); },
      set: function (v) { desc.set.call(this, swap(v)); }
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (window.Chart && window.Chart.defaults) {
      window.Chart.defaults.color = '#9298ad';
      window.Chart.defaults.borderColor = '#2e2d3d';
    }
  });
})();
