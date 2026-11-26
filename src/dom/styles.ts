// src/dom/styles.ts
const CSS = `
.ymw-anchor { position: relative; container-type: inline-size; }
/* B2: top-left, sized like the inline preview's native buttons. */
.ymw-mark-btn {
  position: absolute; top: 8px; left: 8px; z-index: 60;
  width: 40px; height: 40px; padding: 0;
  display: none; align-items: center; justify-content: center;
  border: none; border-radius: 50%; cursor: pointer;
  background: rgba(0,0,0,0.6); color: #fff;
}
.ymw-mark-btn svg { width: 24px; height: 24px; fill: currentColor; }
/* Small thumbnails (watch-page sidebar) get the smaller button. */
@container (max-width: 300px) {
  .ymw-mark-btn { width: 28px; height: 28px; }
  .ymw-mark-btn svg { width: 16px; height: 16px; }
}
.ymw-mark-btn:hover { background: rgba(0,0,0,0.8); }
.ymw-mark-btn.ymw-done { background: rgba(0,0,0,0.85); color: #3ea6ff; }
.ymw-anchor:hover .ymw-mark-btn,
.ymw-anchor:focus-within .ymw-mark-btn,
ytd-video-preview:hover .ymw-mark-btn { display: inline-flex; }
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
