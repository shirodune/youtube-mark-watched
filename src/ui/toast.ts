// src/ui/toast.ts
export function showToast(message: string): void {
  const el = document.createElement('div');
  el.textContent = message;
  el.setAttribute('role', 'status');
  Object.assign(el.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 16px',
    borderRadius: '8px', zIndex: '99999', fontSize: '14px', pointerEvents: 'none',
  } as CSSStyleDeclaration);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
