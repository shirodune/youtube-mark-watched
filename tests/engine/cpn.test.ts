import { describe, expect, it } from 'vitest';
import { CPN_CHARS, generateCpn } from '../../src/engine/cpn';

describe('generateCpn', () => {
  it('returns a 16-character string', () => {
    expect(generateCpn()).toHaveLength(16);
  });
  it('uses only the YouTube cpn charset', () => {
    const cpn = generateCpn();
    for (const ch of cpn) expect(CPN_CHARS).toContain(ch);
  });
  it('produces different values across calls', () => {
    const a = generateCpn(),
      b = generateCpn();
    expect(a).not.toBe(b);
  });
});
