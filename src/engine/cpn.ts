// src/engine/cpn.ts

export const CPN_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function generateCpn(): string {
  let cpn = '';
  for (let i = 0; i < 16; i++) {
    cpn += CPN_CHARS[Math.floor(Math.random() * CPN_CHARS.length)];
  }
  return cpn;
}
