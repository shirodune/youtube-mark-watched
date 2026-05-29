// src/dom/decorate.ts
import { DECORATED_ATTR } from './thumbnails';

const EYE_SVG =
  '<svg viewBox="0 0 24 24"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z"/></svg>';

export function injectButton(anchor: HTMLAnchorElement, onClick: () => void): void {
  if (anchor.hasAttribute(DECORATED_ATTR)) return;
  anchor.setAttribute(DECORATED_ATTR, '1');
  anchor.classList.add('ymw-anchor');

  const btn = document.createElement('button');
  btn.className = 'ymw-mark-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Mark as watched');
  btn.title = 'Mark as watched';
  btn.innerHTML = EYE_SVG;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  anchor.appendChild(btn);
}

export function applyWatchedStyle(anchor: HTMLAnchorElement): void {
  anchor.classList.add('ymw-watched');
  if (!anchor.querySelector('.ymw-watched-bar')) {
    const bar = document.createElement('div');
    bar.className = 'ymw-watched-bar';
    anchor.appendChild(bar);
  }
}

export function removeWatchedStyle(anchor: HTMLAnchorElement): void {
  anchor.classList.remove('ymw-watched');
  anchor.querySelector('.ymw-watched-bar')?.remove();
}

export function markButtonState(anchor: HTMLAnchorElement, done: boolean): void {
  const btn = anchor.querySelector('button.ymw-mark-btn');
  if (btn) btn.classList.toggle('ymw-done', done);
}
