// src/dom/styles.ts
const CSS = `
.ymw-anchor { position: relative; }
.ymw-mark-btn {
  position: absolute; top: 8px; left: 8px; z-index: 60;
  width: 28px; height: 28px; padding: 0;
  display: none; align-items: center; justify-content: center;
  border: none; border-radius: 50%; cursor: pointer;
  background: rgba(0,0,0,0.6); color: #fff;
}
.ymw-mark-btn svg { width: 16px; height: 16px; fill: currentColor; }
.ymw-mark-btn:hover { background: rgba(0,0,0,0.8); }
.ymw-mark-btn.ymw-done { background: rgba(0,0,0,0.85); color: #3ea6ff; }
.ymw-anchor:hover .ymw-mark-btn, .ymw-mark-btn:focus-visible { display: inline-flex; }
.ymw-watched-bar {
  position: absolute; left: 0; right: 0; bottom: 0; height: 4px; z-index: 60;
  background: #ff0000;
}
`;

export function injectStylesOnce(): void {
  if (document.getElementById('ymw-styles')) return;
  const el = document.createElement('style');
  el.id = 'ymw-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}
