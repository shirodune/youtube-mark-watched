import { describe, it, expect } from 'vitest';
import { generateCpn, CPN_CHARS } from '../../src/engine/cpn';

describe('generateCpn', () => {
  it('returns a 16-character string', () => {
    expect(generateCpn()).toHaveLength(16);
  });
  it('uses only the YouTube cpn charset', () => {
    const cpn = generateCpn();
    for (const ch of cpn) expect(CPN_CHARS).toContain(ch);
  });
  it('produces different values across calls', () => {
    const a = generateCpn(), b = generateCpn();
    expect(a).not.toBe(b);
  });
});
